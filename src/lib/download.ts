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

export async function downloadFilesSequentially(files: DownloadFile[], delayMs = 180) {
  for (const file of files) {
    downloadBlob(file.blob, file.name);
    if (files.length > 1) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
}

type PickerWindow = Window & {
  showDirectoryPicker?: (opts?: { mode?: string }) => Promise<{
    getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
      createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
    }>;
  }>;
  showSaveFilePicker?: (opts?: {
    suggestedName?: string;
    types?: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<{
    createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
  }>;
};

export async function saveFilesToDirectory(files: DownloadFile[]): Promise<SaveResult> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) return "unsupported";
  try {
    const dir = await picker({ mode: "readwrite" });
    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
    }
    return "saved";
  } catch (error) {
    return (error as { name?: string })?.name === "AbortError" ? "cancelled" : "unsupported";
  }
}

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

/**
 * Ask for a destination.  Chrome/Edge use the native save picker; browsers
 * without the File System Access API fall back to their normal download flow.
 */
export async function saveFilesChoosingLocation(files: DownloadFile[]): Promise<SaveResult> {
  if (files.length === 1) {
    const result = await saveBlobWithPicker(files[0].blob, files[0].name);
    if (result !== "unsupported") return result;
  } else {
    const result = await saveFilesToDirectory(files);
    if (result !== "unsupported") return result;
  }
  await downloadFilesSequentially(files);
  return "unsupported";
}

export function safeFileName(input: string, fallback = "calicocutters"): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || fallback;
}
