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

/** Save several files one by one. The picker proposes the last folder used. */
export async function saveFilesChoosingSameLocation(files: DownloadFile[]): Promise<SaveResult> {
  for (const file of files) {
    const result = await saveBlobChoosingLocation(file.blob, file.name);
    if (result === "cancelled") return "cancelled";
  }
  return "saved";
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
