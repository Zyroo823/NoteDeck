import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StudyGuideContent, AiGenerationOutput } from "../src/lib/schemas";
import type { StudyChatTurn } from "../src/types/api";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  googleSubject?: string;
  role?: "admin" | "user";
  suspended?: boolean;
  sessionVersion?: number;
  termsAcceptedAt?: string;
  termsVersion?: string;
  createdAt: string;
}

export interface StudySource {
  text: string;
  truncated: boolean;
}

export interface StudySetRecord {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  sourceType: "manual" | "ai" | "audio";
  studySource?: StudySource;
  chatTurns?: StudyChatTurn[];
  createdAt: string;
  updatedAt: string;
}

export interface FolderRecord {
  id: string;
  userId: string;
  name: string;
}

export interface CardRecord {
  id: string;
  setId: string;
  term: string;
  definition: string;
  position: number;
  isStarred: boolean;
  masteryStatus: "new" | "learning" | "mastered";
}

export interface StudyGuideRecord {
  id: string;
  userId: string;
  folderId?: string | null;
  setId: string | null;
  title: string;
  content: StudyGuideContent;
  createdAt: string;
  updatedAt: string;
}

export interface QuizAttemptRecord {
  id: string;
  userId: string;
  setId: string;
  attemptType: "set_test" | "practice_test";
  score: number;
  total: number;
  createdAt: string;
}

export interface GenerationJobRecord {
  id: string;
  userId: string;
  status: "pending" | "processing" | "done" | "failed";
  stepMessage: string;
  sourceKind: "text" | "file" | "audio";
  studySource?: StudySource;
  previewResult: AiGenerationOutput | null;
  resultSetId: string | null;
  resultGuideId: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseState {
  users: UserRecord[];
  folders?: FolderRecord[];
  studySets: StudySetRecord[];
  cards: CardRecord[];
  studyGuides: StudyGuideRecord[];
  quizAttempts: QuizAttemptRecord[];
  generationJobs: GenerationJobRecord[];
  adminAudit?: { actorId: string; targetId: string; action: string; createdAt: string }[];
}

const DATA_DIR = path.resolve(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, originalHex] = parts;
  const candidate = crypto.scryptSync(password, salt, 64);
  const original = Buffer.from(originalHex, "hex");
  if (candidate.length !== original.length) return false;
  return crypto.timingSafeEqual(candidate, original);
}

export function createSessionToken(userId: string): string {
  const user = readDb().users.find((record) => record.id === userId);
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, iat: Date.now(), version: user?.sessionVersion ?? 0 }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      uid?: string;
      version?: number;
    };
    if (typeof parsed.uid !== "string") return null;
    const user = readDb().users.find((record) => record.id === parsed.uid);
    if (!user || user.suspended || (parsed.version ?? 0) !== (user.sessionVersion ?? 0)) return null;
    return parsed.uid;
  } catch {
    return null;
  }
}

function emptyDatabase(): DatabaseState {
  return {
    users: [],
    studySets: [],
    cards: [],
    studyGuides: [],
    quizAttempts: [],
    generationJobs: [],
  };
}

function removeLegacyDemo(state: DatabaseState): void {
  const demo = state.users.find((user) => user.id === "user-demo-student" && user.email === "demo@notedeck.app");
  if (!demo) return;

  const setIds = new Set(state.studySets.filter((set) => set.userId === demo.id).map((set) => set.id));
  state.users = state.users.filter((user) => user.id !== demo.id);
  state.studySets = state.studySets.filter((set) => !setIds.has(set.id));
  state.cards = state.cards.filter((card) => !setIds.has(card.setId));
  state.studyGuides = state.studyGuides.filter((guide) => guide.userId !== demo.id);
  state.quizAttempts = state.quizAttempts.filter((attempt) => attempt.userId !== demo.id && !setIds.has(attempt.setId));
  state.generationJobs = state.generationJobs.filter((job) => job.userId !== demo.id);
  state.folders = state.folders?.filter((folder) => folder.userId !== demo.id);
  state.adminAudit = state.adminAudit?.filter((entry) => entry.actorId !== demo.id && entry.targetId !== demo.id);
  writeDb(state);
}

export function readDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const state = emptyDatabase();
    writeDb(state);
    return state;
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const state = JSON.parse(raw) as DatabaseState;
  removeLegacyDemo(state);
  return state;
}

export function writeDb(state: DatabaseState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = path.join(DATA_DIR, `db.${process.pid}.tmp`);
  fs.writeFileSync(tempFile, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tempFile, DB_FILE);
}

export function countGenerationsToday(db: Pick<DatabaseState, "generationJobs">, userId: string): number {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const cutoff = startOfDay.getTime();
  return db.generationJobs.filter(
    (job) =>
      job.userId === userId &&
      job.status !== "failed" &&
      new Date(job.createdAt).getTime() >= cutoff
  ).length;
}
