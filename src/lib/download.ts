export interface DownloadFile {
  name: string;
  blob: Blob;
}

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

export async function saveFilesToDirectory(files: DownloadFile[]): Promise<boolean> {
  const picker = (window as unknown as {
    showDirectoryPicker?: (opts?: { mode?: string }) => Promise<{
      getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<{
        createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }>;
      }>;
    }>;
  }).showDirectoryPicker;
  if (!picker) return false;
  try {
    const dir = await picker({ mode: "readwrite" });
    for (const file of files) {
      const handle = await dir.getFileHandle(file.name, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file.blob);
      await writable.close();
    }
    return true;
  } catch {
    return false;
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
