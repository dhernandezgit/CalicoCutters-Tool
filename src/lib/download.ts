export interface DownloadFile {
  name: string;
  blob: Blob;
}

export type SaveResult = "saved" | "cancelled" | "unsupported";

let lastSavedHandle: unknown = null;

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

/**
 * Save several files one by one. The first file handle is passed as the
 * starting point for the rest, so the picker proposes the same folder.
 */
export async function saveFilesChoosingSameLocation(files: DownloadFile[]): Promise<SaveResult> {
  lastSavedHandle = null;
  let anchor: unknown = null;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const result = await saveBlobChoosingLocation(
      file.blob,
      file.name,
      "Archivo CalicoCutters",
      index === 0 ? undefined : anchor,
    );
    if (result === "cancelled") return "cancelled";
    if (index === 0) anchor = lastSavedHandle;
    if (index < files.length - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
  }
  return "saved";
}

/** Save one file with the native picker, or fall back to a normal download. */
export async function saveBlobChoosingLocation(
  blob: Blob,
  filename: string,
  description = "Archivo CalicoCutters",
  startIn?: unknown,
): Promise<SaveResult> {
  const result = await saveBlobWithPicker(blob, filename, description, startIn);
  if (result === "unsupported") {
    downloadBlob(blob, filename);
    return "saved";
  }
  return result;
}

type PickerWindow = Window & {
  showSaveFilePicker?: (opts?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
    startIn?: unknown;
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
  startIn?: unknown,
): Promise<SaveResult> {
  const picker = (window as PickerWindow).showSaveFilePicker;
  if (!picker) return "unsupported";
  const ext = extensionOf(filename);
  const options = {
    suggestedName: filename,
    types: ext
      ? [{ description, accept: { "application/octet-stream": [ext] } }]
      : undefined,
    ...(startIn ? { startIn } : {}),
  };
  try {
    const handle = await picker(options);
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    lastSavedHandle = handle;
    return "saved";
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "AbortError") return "cancelled";
    if (startIn) {
      // Some browsers expose the picker without supporting file handles as
      // startIn. Retry in the default folder instead of falling back to a
      // normal download.
      return saveBlobWithPicker(blob, filename, description);
    }
    return "unsupported";
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
