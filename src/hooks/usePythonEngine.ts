import { useCallback, useEffect, useRef, useState } from "react";
import type { BuildResult, DesignShape, DesignSettings } from "../types";

type Status = "loading" | "ready" | "error";

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

export function base64ToBytes(value: string): Uint8Array {
  const bin = atob(value);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

function normalizeShape(raw: any, previewUrl?: string): DesignShape {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(raw.name ?? "Diseño"),
    sourceKind: raw.source_kind === "raster" ? "raster" : raw.source_kind === "builtin" ? "builtin" : "svg",
    outer: raw.outer ?? [],
    holes: raw.holes ?? [],
    details: raw.details ?? [],
    extras: raw.extras ?? [],
    bounds: raw.bounds,
    warnings: raw.warnings ?? [],
    imageSize: raw.image_size ? { width: raw.image_size[0], height: raw.image_size[1] } : undefined,
    sourceColor: raw.source_color,
    previewUrl,
  };
}

export function usePythonEngine() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef(new Map<number, Pending>());
  const nextId = useRef(1);
  const readyRef = useRef(false);
  const [status, setStatus] = useState<Status>("loading");
  const [progressText, setProgressText] = useState("Preparando el motor Python…");
  const [progressStep, setProgressStep] = useState(0);
  const [engineError, setEngineError] = useState("");

  useEffect(() => {
    const worker = new Worker(new URL("../workers/pyodide.worker.ts", import.meta.url), {
      type: "module",
    });
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data || {};
      if (data.type === "progress") {
        setProgressText(String(data.text || ""));
        setProgressStep(Number(data.step || 0));
        return;
      }
      if (data.type === "ready") {
        readyRef.current = true;
        setStatus("ready");
        setProgressText("Motor listo");
        return;
      }
      if (data.type === "result" || data.type === "error") {
        const item = pending.current.get(Number(data.id));
        if (!item) return;
        pending.current.delete(Number(data.id));
        if (data.type === "result") item.resolve(data.data);
        else item.reject(new Error(String(data.error || "Error del motor Python")));
      }
    };
    worker.onerror = (event) => {
      setStatus("error");
      setEngineError(event.message || "No se pudo iniciar el motor Python.");
    };
    const zipUrl = new URL("calicocutters.zip", document.baseURI).href;
    worker.postMessage({ type: "init", zipUrl });
    return () => {
      worker.terminate();
      workerRef.current = null;
      readyRef.current = false;
    };
  }, []);

  const request = useCallback((type: string, payload: unknown): Promise<any> => {
    const worker = workerRef.current;
    if (!worker) return Promise.reject(new Error("El motor no está iniciado."));
    if (!readyRef.current) return Promise.reject(new Error("El motor Python todavía está cargando. Espera un momento."));
    const id = nextId.current++;
    return new Promise((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      worker.postMessage({ type, id, payload });
    });
  }, []);

  const analyzeFile = useCallback(async (file: File, previewUrl?: string) => {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await request("analyze", {
      filename: file.name,
      data_b64: bytesToBase64(bytes),
      target_mm: 75,
    });
    if (!result.ok) throw new Error(result.error || "No se pudo analizar el archivo.");
    return normalizeShape(result.shape, previewUrl);
  }, [request]);

  const analyzeText = useCallback(async (text: string, filename: string) => {
    const bytes = new TextEncoder().encode(text);
    const result = await request("analyze", {
      filename,
      data_b64: bytesToBase64(bytes),
      target_mm: 75,
    });
    if (!result.ok) throw new Error(result.error || "No se pudo analizar el SVG.");
    return normalizeShape(result.shape);
  }, [request]);

  const build = useCallback(async (shape: DesignShape, settings: DesignSettings): Promise<BuildResult> => {
    const result = await request("build", {
      shape: {
        name: shape.name,
        outer: shape.outer,
        holes: shape.holes,
        details: shape.details,
        extras: shape.extras,
        source_kind: shape.sourceKind,
        warnings: shape.warnings,
        bounds: shape.bounds,
      },
      settings,
    });
    if (!result.ok) throw new Error(result.error || "No se pudo generar la geometría.");
    return result as BuildResult;
  }, [request]);

  const export3mf = useCallback(async (
    shape: DesignShape,
    settings: DesignSettings,
    parts: string[],
    name: string,
  ): Promise<Blob> => {
    const result = await request("export3mf", {
      shape: {
        name: shape.name,
        outer: shape.outer,
        holes: shape.holes,
        details: shape.details,
        extras: shape.extras,
        source_kind: shape.sourceKind,
        warnings: shape.warnings,
        bounds: shape.bounds,
      },
      settings,
      parts,
      name,
    });
    if (!result.ok) throw new Error(result.error || "No se pudo generar el 3MF.");
    return bytesToBlob(base64ToBytes(result.data_b64), "application/vnd.ms-3mfdocument");
  }, [request]);

  const export3mfMulti = useCallback(async (
    items: { name: string; shape: DesignShape; settings: DesignSettings }[],
    name: string,
  ): Promise<Blob> => {
    const result = await request("export3mfMulti", {
      items: items.map((item) => ({
        name: item.name,
        settings: item.settings,
        shape: {
          name: item.shape.name,
          outer: item.shape.outer,
          holes: item.shape.holes,
          details: item.shape.details,
          extras: item.shape.extras,
          source_kind: item.shape.sourceKind,
          warnings: item.shape.warnings,
          bounds: item.shape.bounds,
        },
      })),
      name,
    });
    if (!result.ok) throw new Error(result.error || "No se pudo generar el 3MF conjunto.");
    return bytesToBlob(base64ToBytes(result.data_b64), "application/vnd.ms-3mfdocument");
  }, [request]);

  return {
    status,
    ready: status === "ready",
    progressText,
    progressStep,
    engineError,
    analyzeFile,
    analyzeText,
    build,
    export3mf,
    export3mfMulti,
  };
}
