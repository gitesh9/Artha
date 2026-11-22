import Papa from "papaparse";

/** Document bytes stay on this device; only confirmed transaction fields are synced. */
export async function parseFile(file: File, progress: (message: string) => void): Promise<{ grid: string[][]; text: string }> {
  if (file.size > 20 * 1024 * 1024) throw new Error("Choose a file smaller than 20 MB.");
  if (/\.csv$/i.test(file.name)) {
    const parsed = Papa.parse<string[]>(await file.text(), { skipEmptyLines: true });
    if (parsed.errors.some(e => e.type === "Quotes")) throw new Error("CSV quotes are incomplete. Repair the file before importing.");
    return { grid: parsed.data.slice(0, 501), text: "" };
  }
  if (/\.xlsx$/i.test(file.name)) {
    const { default: read } = await import("read-excel-file");
    const rows = await read(file);
    return { grid: rows.slice(0, 501).map(row => row.map(v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""))), text: "" };
  }
  if (/\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist"); const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    if (pdf.numPages > 50) { await pdf.destroy(); throw new Error("Split this statement into files of at most 50 pages."); }
    let text = "";
    try { for (let i = 1; i <= pdf.numPages; i++) { progress(`Reading page ${i} of ${pdf.numPages}…`); const page = await pdf.getPage(i); const content = await page.getTextContent(); text += content.items.map(item => "str" in item ? item.str + (item.hasEOL ? "\n" : "\t") : "").join("") + "\n"; } } finally { await pdf.destroy(); }
    return { grid: [], text: text.trim() };
  }
  if (/\.(png|jpe?g|webp)$/i.test(file.name)) return { grid: [], text: await ocr(file, progress) };
  throw new Error("Supported: CSV, XLSX, PDF, JPG, PNG and WebP. Convert older XLS files to XLSX first.");
}
export async function ocr(file: File, progress: (message: string) => void) {
  const { createWorker } = await import("tesseract.js");
  const { default: workerPath } = await import("tesseract.js/dist/worker.min.js?url");
  const { default: corePath } = await import("tesseract.js-core/tesseract-core-lstm.wasm.js?url");
  const worker = await createWorker("eng", 1, { workerPath, corePath, langPath: `${window.location.origin}/ocr`, logger: m => progress(`${m.status} ${Math.round((m.progress ?? 0) * 100)}%`) });
  try { const result = await worker.recognize(file); return result.data.text; } finally { await worker.terminate(); }
}
export async function ocrPdf(file: File, progress: (message: string) => void) {
  const pdfjs = await import("pdfjs-dist"); const { default: worker } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url"); pdfjs.GlobalWorkerOptions.workerSrc = worker;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  if (pdf.numPages > 10) { await pdf.destroy(); throw new Error("OCR supports at most 10 pages per file."); }
  let text = "";
  try { for (let i = 1; i <= pdf.numPages; i++) { progress(`Scanning page ${i}…`); const page = await pdf.getPage(i); const viewport = page.getViewport({ scale: 1.5 }); const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height; const context = canvas.getContext("2d"); if (!context) throw new Error("Image reading is unavailable."); await page.render({ canvasContext: context, canvas, viewport }).promise; const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(v => v ? resolve(v) : reject(new Error("Image conversion failed")), "image/png")); text += await ocr(new File([blob], "page.png", { type: "image/png" }), progress) + "\n"; } } finally { await pdf.destroy(); }
  return text;
}