import { Readable } from "node:stream";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";

export const MAX_UPLOAD_PAGES = 80;
const MAX_PPTX_TEXT_BYTES = 4 * 1024 * 1024;
const MAX_PPTX_ENTRIES = 5_000;

export class UploadContentError extends Error {}

export interface ExtractedSourcePayload {
  textParts: string[];
  pdfFiles: { name: string; base64: string }[];
}

function stripXmlTags(xml: string): string {
  return xml
    .replace(/<a:br\s*\/>/gi, "\n")
    .replace(/<\/a:p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTrailingNumber(filename: string): number {
  const match = filename.match(/(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw new UploadContentError("Invalid PowerPoint file.");
  const zip = await JSZip.loadAsync(buffer);
  const paths = Object.keys(zip.files);
  if (!zip.file("[Content_Types].xml") || !zip.file("ppt/presentation.xml") || paths.length > MAX_PPTX_ENTRIES) {
    throw new UploadContentError("Invalid or overly complex PowerPoint file.");
  }
  const slidePaths = paths
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

  const notesPaths = paths
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

  if (!slidePaths.length || slidePaths.length > MAX_UPLOAD_PAGES || notesPaths.length > MAX_UPLOAD_PAGES) {
    throw new UploadContentError(`PowerPoint files must have 1 to ${MAX_UPLOAD_PAGES} slides.`);
  }

  let bytes = 0;
  async function readXml(path: string): Promise<string> {
    const file = zip.file(path);
    if (!file) throw new UploadContentError("Invalid PowerPoint file.");
    const parts: Buffer[] = [];
    const stream = new Readable().wrap(file.nodeStream("nodebuffer"));
    for await (const part of stream) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      bytes += chunk.length;
      if (bytes > MAX_PPTX_TEXT_BYTES) throw new UploadContentError("PowerPoint text exceeds the extraction limit.");
      parts.push(chunk);
    }
    return Buffer.concat(parts).toString("utf8");
  }
  const types = await readXml("[Content_Types].xml");
  if (!types.includes("application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml")) {
    throw new UploadContentError("Invalid PowerPoint file.");
  }
  const chunks: string[] = [];
  for (const path of [...slidePaths, ...notesPaths]) {
    const text = stripXmlTags(await readXml(path));
    const label = path.startsWith("ppt/slides/") ? "Slide" : "Speaker Notes";
    if (text) chunks.push(`${label} ${extractTrailingNumber(path)}:\n${text}`);
  }

  return chunks.join("\n\n").trim();
}

export async function extractFromUploadedFiles(
  files: { originalname: string; buffer: Buffer }[]
): Promise<ExtractedSourcePayload> {
  const textParts: string[] = [];
  const pdfFiles: { name: string; base64: string }[] = [];

  for (const file of files) {
    const lower = file.originalname.toLowerCase();
    if (lower.endsWith(".pdf")) {
      if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new UploadContentError("Invalid PDF file.");
      const pdf = await PDFDocument.load(file.buffer, { throwOnInvalidObject: true, updateMetadata: false });
      const pages = pdf.getPageCount();
      if (pages < 1 || pages > MAX_UPLOAD_PAGES) {
        throw new UploadContentError(`PDFs must have 1 to ${MAX_UPLOAD_PAGES} pages.`);
      }
      pdfFiles.push({
        name: file.originalname,
        base64: file.buffer.toString("base64"),
      });
    } else if (lower.endsWith(".pptx")) {
      const text = await extractPptxText(file.buffer);
      if (text) {
        textParts.push(`Presentation (${file.originalname}):\n${text}`);
      }
    } else {
      throw new UploadContentError("Upload a PDF or PowerPoint file.");
    }
  }

  return { textParts, pdfFiles };
}
