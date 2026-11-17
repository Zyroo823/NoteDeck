export interface StudyCardItem {
  id: string;
  term: string;
  definition: string;
  position: number;
}

export interface QuizQuestion {
  cardId: string;
  prompt: string;
  correctAnswer: string;
  options: string[];
}

export interface QuizAnswerResult {
  cardId: string;
  prompt: string;
  selected: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export interface QuizGradeSummary {
  score: number;
  total: number;
  percentage: number;
  results: QuizAnswerResult[];
}

export interface UploadFileCandidate {
  name: string;
  type: string;
  size: number;
}

export interface UploadValidationResult {
  valid: boolean;
  error: string | null;
}

export interface MarkdownLineToken {
  kind: "bold" | "code" | "text";
  value: string;
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_FILES = 2;

const UPLOAD_MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function cleanPlainText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
}

export function shuffleCards(cards: StudyCardItem[]): StudyCardItem[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

function shuffleStrings(items: string[]): string[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

// Builds multiple-choice questions using distractor definitions from other cards in the same set
export function buildQuizQuestions(cards: StudyCardItem[]): QuizQuestion[] {
  if (cards.length === 0) return [];

  const uniqueDefs = Array.from(new Set(cards.map((c) => c.definition.trim()).filter(Boolean)));
  const maxOptions = Math.min(4, uniqueDefs.length);

  return cards.map((card) => {
    const correctAnswer = card.definition.trim();
    const distractorPool = uniqueDefs.filter((def) => def !== correctAnswer);
    const pickedDistractors = shuffleStrings(distractorPool).slice(0, Math.max(0, maxOptions - 1));
    const options = shuffleStrings([correctAnswer, ...pickedDistractors]);

    return {
      cardId: card.id,
      prompt: card.term,
      correctAnswer,
      options,
    };
  });
}

export function gradeQuiz(
  questions: QuizQuestion[],
  selections: Record<string, string>
): QuizGradeSummary {
  const results: QuizAnswerResult[] = questions.map((q) => {
    const selected = selections[q.cardId] ?? "";
    const isCorrect = selected === q.correctAnswer;
    return {
      cardId: q.cardId,
      prompt: q.prompt,
      selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
    };
  });

  const score = results.filter((r) => r.isCorrect).length;
  const total = questions.length;
  const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

  return { score, total, percentage, results };
}

export function validateUploadFiles(files: UploadFileCandidate[]): UploadValidationResult {
  if (files.length === 0) {
    return { valid: false, error: "Select at least one PDF or PowerPoint file." };
  }
  if (files.length > MAX_UPLOAD_FILES) {
    return { valid: false, error: "Upload up to 2 files at a time." };
  }

  for (const file of files) {
    const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] ?? "";
    const mimeType = UPLOAD_MIME_BY_EXTENSION[extension];
    if (!mimeType) {
      return {
        valid: false,
        error: `"${file.name}" is not supported. Upload PDF or PowerPoint files, or paste your notes.`,
      };
    }

    if (file.type && file.type !== "application/octet-stream" && file.type !== mimeType) {
      return {
        valid: false,
        error: `"${file.name}" has an unsupported file type (${file.type}).`,
      };
    }

    if (file.size <= 0) {
      return { valid: false, error: `"${file.name}" is empty.` };
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return {
        valid: false,
        error: `"${file.name}" exceeds the 25MB per-file limit.`,
      };
    }
  }

  return { valid: true, error: null };
}

// Strips raw HTML tags and unsafe patterns from AI/user text before safe token rendering
export function sanitizeMarkdownText(raw: string): string {
  return cleanPlainText(raw)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "");
}

// Parses inline **bold** and `code` tokens safely without HTML injection
export function tokenizeSafeMarkdown(raw: string): MarkdownLineToken[] {
  const safe = sanitizeMarkdownText(raw);
  const tokens: MarkdownLineToken[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;

  for (const match of safe.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({ kind: "text", value: safe.slice(lastIndex, idx) });
    }
    const segment = match[0];
    if (segment.startsWith("**") && segment.endsWith("**")) {
      tokens.push({ kind: "bold", value: segment.slice(2, -2) });
    } else if (segment.startsWith("`") && segment.endsWith("`")) {
      tokens.push({ kind: "code", value: segment.slice(1, -1) });
    }
    lastIndex = idx + segment.length;
  }

  if (lastIndex < safe.length) {
    tokens.push({ kind: "text", value: safe.slice(lastIndex) });
  }

  return tokens;
}
