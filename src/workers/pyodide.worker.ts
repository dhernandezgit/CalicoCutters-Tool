/// <reference lib="webworker" />

/* Pyodide worker: runs the real Python package in WebAssembly. */

const CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";
let py: any = null;
let ready = false;

function send(message: Record<string, unknown>) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(message);
}

function progress(text: string, step?: number) {
  send({ type: "progress", text, step });
}

async function boot(zipUrl: string) {
  if (ready) {
    send({ type: "ready" });
    return;
  }
  progress("Cargando Python en el navegador (WebAssembly)…", 1);
  const mod = await import(/* @vite-ignore */ `${CDN}pyodide.mjs`);
  py = await mod.loadPyodide({ indexURL: CDN });

  progress("Cargando NumPy, Pillow, Shapely, SciPy y OpenCV…", 2);
  await py.loadPackage(["numpy", "pillow", "shapely", "scipy", "opencv-python"]);

  progress("Descargando el motor CalicoCutters…", 3);
  const response = await fetch(zipUrl, { cache: "no-cache" });
  if (!response.ok) throw new Error(`No se pudo descargar el motor (${response.status}).`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  py.FS.writeFile("/calicocutters.zip", bytes);

  progress("Preparando el motor…", 4);
  await py.runPythonAsync(`
import zipfile, sys, os
os.makedirs("/motor", exist_ok=True)
with zipfile.ZipFile("/calicocutters.zip") as z:
    z.extractall("/motor")
sys.path.insert(0, "/motor")
`);
  ready = true;
  progress("Motor listo", 5);
  send({ type: "ready" });
}

async function call(name: "analizar" | "construir" | "exportar_3mf" | "exportar_3mf_multi", payload: unknown) {
  py.globals.set("_payload", JSON.stringify(payload));
  const result = await py.runPythonAsync(
    `from calicocutters import webapi\nwebapi.${name}(_payload)`,
  );
  return JSON.parse(result);
}

async function handle(data: Record<string, any>) {
  try {
    if (data.type === "init") {
      await boot(String(data.zipUrl));
      return;
    }
    if (!ready || !py) throw new Error("El motor de Python todavía no está listo.");
    if (data.type === "analyze") {
      const result = await call("analizar", data.payload);
      send({ type: "result", id: data.id, data: result });
    } else if (data.type === "build") {
      const result = await call("construir", data.payload);
      send({ type: "result", id: data.id, data: result });
    } else if (data.type === "export3mf") {
      const result = await call("exportar_3mf", data.payload);
      send({ type: "result", id: data.id, data: result });
    } else if (data.type === "export3mfMulti") {
      const result = await call("exportar_3mf_multi", data.payload);
      send({ type: "result", id: data.id, data: result });
    }
  } catch (error) {
    const message = String((error as { message?: string })?.message || error);
    if (data.type === "init") {
      send({ type: "fatal", error: message });
    } else {
      send({ type: "error", id: data.id, error: message });
    }
  }
}

// Pyodide is not re-entrant and `_payload` is shared state. Serialize every
// request so a fast slider change or an export can never race a build.
let queue: Promise<void> = Promise.resolve();
self.onmessage = (event: MessageEvent) => {
  const data = (event.data || {}) as Record<string, any>;
  queue = queue.then(() => handle(data));
};
