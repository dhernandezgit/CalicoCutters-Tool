import { zip, type Zippable } from "fflate";

export interface DownloadFile {
  name: string;
  blob: Blob;
}

export type SaveResult = "saved" | "cancelled" | "unsupported";

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function uniqueDownloadFiles(files: DownloadFile[]): DownloadFile[] {
  const used = new Set<string>();
  return files.map((file) => {
    let name = file.name;
    if (!used.has(name)) {
      used.add(name);
      return file;
    }
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let n = 2;
    while (used.has(`${stem}-${n}${ext}`)) n += 1;
    name = `${stem}-${n}${ext}`;
    used.add(name);
    return { ...file, name };
  });
}

export async function filesToZip(files: DownloadFile[]): Promise<Blob> {
  const unique = uniqueDownloadFiles(files);
  const entries: Zippable = {};
  for (const file of unique) {
    entries[file.name] = new Uint8Array(await file.blob.arrayBuffer());
  }
  return new Promise((resolve, reject) => {
    zip(entries, { level: 6 }, (error, data) => {
      if (error) {
        reject(error);
        return;
      }
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      resolve(new Blob([copy.buffer], { type: "application/zip" }));
    });
  });
}

/** Save one file with the native picker, or fall back to a normal download. */
export async function saveBlobChoosingLocation(
  blob: Blob,
  filename: string,
  description = "Archivo CalicoCutters",
): Promise<SaveResult> {
  const result = await saveBlobWithPicker(blob, filename, description);
  if (result === "unsupported") {
    downloadBlob(blob, filename);
    return "saved";
  }
  return result;
}

/** Save a ZIP; this always produces one normal download when pickers fail. */
export async function saveZipChoosingLocation(
  files: DownloadFile[],
  zipName: string,
): Promise<SaveResult> {
  const blob = await filesToZip(files);
  return saveBlobChoosingLocation(blob, zipName, "Archivos CalicoCutters");
}

type PickerWindow = Window & {
  showSaveFilePicker?: (opts?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

function extensionOf(filename: string): string {
  const i = filename.lastIndexOf(".");
  return i >= 0 ? filename.slice(i) : "";
}

export async function saveBlobWithPicker(
  blob: Blob,
  filename: string,
  description = "Archivo CalicoCutters",
): Promise<SaveResult> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (!picker) return "unsupported";
  try {
    const ext = extensionOf(filename);
    const handle = await picker({
      suggestedName: filename,
      types: ext
        ? [{ description, accept: { "application/octet-stream": [ext] } }]
        : undefined,
    });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return "saved";
  } catch (error) {
    return (error as { name?: string })?.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

export function safeFileName(input: string, fallback = "calicocutters"): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
}
