import mammoth from "mammoth";
import JSZip from "jszip";

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

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

  const notesPaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(name))
    .sort((a, b) => extractTrailingNumber(a) - extractTrailingNumber(b));

  const chunks: string[] = [];

  for (const slidePath of slidePaths) {
    const file = zip.files[slidePath];
    if (!file) continue;
    const xml = await file.async("text");
    const slideText = stripXmlTags(xml);
    if (slideText) {
      const slideNum = extractTrailingNumber(slidePath);
      chunks.push(`Slide ${slideNum}:\n${slideText}`);
    }
  }

  for (const notesPath of notesPaths) {
    const file = zip.files[notesPath];
    if (!file) continue;
    const xml = await file.async("text");
    const notesText = stripXmlTags(xml);
    if (notesText) {
      const noteNum = extractTrailingNumber(notesPath);
      chunks.push(`Speaker Notes ${noteNum}:\n${notesText}`);
    }
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
      pdfFiles.push({
        name: file.originalname,
        base64: file.buffer.toString("base64"),
      });
    } else if (lower.endsWith(".docx")) {
      const text = await extractDocxText(file.buffer);
      if (text) {
        textParts.push(`Document (${file.originalname}):\n${text}`);
      }
    } else if (lower.endsWith(".pptx")) {
      const text = await extractPptxText(file.buffer);
      if (text) {
        textParts.push(`Presentation (${file.originalname}):\n${text}`);
      }
    }
  }

  return { textParts, pdfFiles };
}
