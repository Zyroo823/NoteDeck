import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import postgres from "postgres";
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
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

let database: ReturnType<typeof postgres> | undefined;
const snapshots = new WeakMap<DatabaseState, string>();

export class StoreConflict extends Error {}

export async function initializeStorage(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    if (process.env.NODE_ENV === "production") throw new Error("DATABASE_URL is required in production.");
    return;
  }
  const connection = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname);
  // Ignore connection-string SSL flags. Always verify remote server certificates.
  for (const key of ["ssl", "sslmode", "sslrootcert", "sslcert", "sslkey"]) connection.searchParams.delete(key);
  let ssl: false | "verify-full" | { ca: Buffer; rejectUnauthorized: true } = local ? false : "verify-full";
  if (connection.hostname.endsWith(".pooler.supabase.com")) {
    // Supabase's shared pooler uses its own root CA. Keep hostname verification enabled.
    const ca = fs.readFileSync(new URL("./supabase-root.crt", import.meta.url));
    ssl = { ca, rejectUnauthorized: true };
  }
  database = postgres(connection.href, { ssl, max: 5, connect_timeout: 10 });
  await database`
    insert into notedeck_private.study_store (id, state)
    values (1, ${database.json(emptyDatabase() as unknown as postgres.JSONValue)})
    on conflict (id) do nothing
  `;
}

export async function closeStorage(): Promise<void> {
  await database?.end();
}

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

export function createSessionToken(user: UserRecord): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: user.id, iat: Date.now(), version: user.sessionVersion ?? 0 }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined, state: DatabaseState): string | null {
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
      iat?: number;
    };
    const now = Date.now();
    if (typeof parsed.uid !== "string" || typeof parsed.iat !== "number" ||
        !Number.isSafeInteger(parsed.iat) || parsed.iat > now || now - parsed.iat >= SESSION_DURATION_MS) return null;
    const user = state.users.find((record) => record.id === parsed.uid);
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

export function removeLegacyDemo(state: DatabaseState): boolean {
  const demo = state.users.find((user) => user.id === "user-demo-student" && user.email === "demo@notedeck.app");
  if (!demo) return false;

  const setIds = new Set(state.studySets.filter((set) => set.userId === demo.id).map((set) => set.id));
  state.users = state.users.filter((user) => user.id !== demo.id);
  state.studySets = state.studySets.filter((set) => !setIds.has(set.id));
  state.cards = state.cards.filter((card) => !setIds.has(card.setId));
  state.studyGuides = state.studyGuides.filter((guide) => guide.userId !== demo.id);
  state.quizAttempts = state.quizAttempts.filter((attempt) => attempt.userId !== demo.id && !setIds.has(attempt.setId));
  state.generationJobs = state.generationJobs.filter((job) => job.userId !== demo.id);
  state.folders = state.folders?.filter((folder) => folder.userId !== demo.id);
  state.adminAudit = state.adminAudit?.filter((entry) => entry.actorId !== demo.id && entry.targetId !== demo.id);
  return true;
}

export async function readDb(): Promise<DatabaseState> {
  if (database) {
    const [row] = await database<{ state: DatabaseState; revision: string }[]>`
      select state, revision::text from notedeck_private.study_store where id = 1
    `;
    if (!row) throw new Error("NoteDeck storage is not initialized.");
    snapshots.set(row.state, row.revision);
    return row.state;
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const state = emptyDatabase();
    writeLocalDb(state);
    snapshots.set(state, fs.readFileSync(DB_FILE, "utf8"));
    return state;
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const state = JSON.parse(raw) as DatabaseState;
  snapshots.set(state, raw);
  if (removeLegacyDemo(state)) await writeDb(state);
  return state;
}

export async function writeDb(state: DatabaseState, snapshot = state): Promise<void> {
  const revision = snapshots.get(snapshot);
  if (revision === undefined) throw new Error("Write requires a current storage snapshot.");
  if (database) {
    const [row] = await database<{ revision: string }[]>`
      update notedeck_private.study_store
      set state = ${database.json(state as unknown as postgres.JSONValue)}, revision = revision + 1
      where id = 1 and revision = ${revision}::bigint
      returning revision::text
    `;
    if (!row) throw new StoreConflict("The account data changed. Try again.");
    snapshots.set(state, row.revision);
    return;
  }
  if (fs.readFileSync(DB_FILE, "utf8") !== revision) throw new StoreConflict("The account data changed. Try again.");
  snapshots.set(state, writeLocalDb(state));
}

function writeLocalDb(state: DatabaseState): string {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tempFile = path.join(DATA_DIR, `db.${process.pid}.tmp`);
  const serialized = JSON.stringify(state, null, 2);
  fs.writeFileSync(tempFile, serialized, { encoding: "utf8", mode: 0o600 });
  fs.renameSync(tempFile, DB_FILE);
  return serialized;
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
