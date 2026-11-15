import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { StudyGuideContent, AiGenerationOutput } from "../src/lib/schemas";

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  googleSubject?: string;
  role?: "admin" | "user";
  suspended?: boolean;
  sessionVersion?: number;
  createdAt: string;
}

export interface StudySetRecord {
  id: string;
  userId: string;
  folderId: string | null;
  title: string;
  sourceType: "manual" | "ai" | "audio";
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

function buildSeedState(): DatabaseState {
  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 3600 * 1000 * 4).toISOString();
  const demoUserId = "user-demo-student";
  const set1Id = "set-demo-vlans";
  const set2Id = "set-demo-hci";
  const guide1Id = "guide-demo-vlans";
  const guide2Id = "guide-demo-hci";

  return {
    users: [
      {
        id: demoUserId,
        name: "Alex Rivera",
        email: "demo@notedeck.app",
        createdAt: earlier,
      },
    ],
    studySets: [
      {
        id: set1Id,
        userId: demoUserId,
        folderId: null,
        title: "Switching Concepts, VLANs, and Inter-VLAN Routing",
        sourceType: "ai",
        createdAt: earlier,
        updatedAt: now,
      },
      {
        id: set2Id,
        userId: demoUserId,
        folderId: null,
        title: "Human Capabilities and Inclusive Interaction Design",
        sourceType: "manual",
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    cards: [
      {
        id: "card-vlan-1",
        setId: set1Id,
        term: "Native VLAN",
        definition:
          "The untagged VLAN carried across an 802.1Q trunk link; both ends must match to prevent traffic leaks.",
        position: 0,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-2",
        setId: set1Id,
        term: "802.1Q Tagging",
        definition:
          "IEEE standard that inserts a 4-byte VLAN tag into Ethernet frames sent over trunk ports.",
        position: 1,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-3",
        setId: set1Id,
        term: "Access Port",
        definition:
          "A switch port assigned to a single VLAN for end devices such as PCs or printers.",
        position: 2,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-4",
        setId: set1Id,
        term: "Trunk Port",
        definition:
          "A point-to-point link between switches or a router that carries traffic for multiple VLANs.",
        position: 3,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-5",
        setId: set1Id,
        term: "Router-on-a-Stick",
        definition:
          "An inter-VLAN routing method using a single physical router interface split into tagged subinterfaces.",
        position: 4,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-6",
        setId: set1Id,
        term: "SVI (Switch Virtual Interface)",
        definition:
          "A virtual Layer 3 interface on a multilayer switch that routes traffic between VLANs at wire speed.",
        position: 5,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-vlan-7",
        setId: set1Id,
        term: "Broadcast Domain",
        definition:
          "A logical network segment where broadcast frames reach every host; each VLAN forms one broadcast domain.",
        position: 6,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-hci-1",
        setId: set2Id,
        term: "Affordance",
        definition:
          "Visual or physical cues on a control that signal how a person should interact with it.",
        position: 0,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-hci-2",
        setId: set2Id,
        term: "Signifier",
        definition:
          "An explicit indicator such as a label, icon, or arrow that communicates where an action happens.",
        position: 1,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-hci-3",
        setId: set2Id,
        term: "Fitts's Law",
        definition:
          "The time required to reach a target depends on the distance to the target divided by its width.",
        position: 2,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-hci-4",
        setId: set2Id,
        term: "WCAG AA Contrast",
        definition:
          "Accessibility threshold requiring at least 4.5:1 contrast for body text and 3:1 for large text.",
        position: 3,
        isStarred: false,
        masteryStatus: "new",
      },
      {
        id: "card-hci-5",
        setId: set2Id,
        term: "Progressive Disclosure",
        definition:
          "Revealing complex options only when needed so primary screens stay calm and scannable.",
        position: 4,
        isStarred: false,
        masteryStatus: "new",
      },
    ],
    studyGuides: [
      {
        id: guide1Id,
        userId: demoUserId,
        setId: set1Id,
        title: "Switching Concepts & Inter-VLAN Routing Study Guide",
        content: {
          summary:
            "VLANs divide a physical Layer 2 switch into separate **broadcast domains** for security and traffic control. Trunk links carry tagged frames across switches using **802.1Q**, while **Router-on-a-Stick** or **Layer 3 SVIs** enable communication between separate VLANs.",
          key_concepts: [
            {
              heading: "Access vs. Trunk Links",
              bullets: [
                "**Access ports** connect end hosts and belong to one untagged VLAN.",
                "**Trunk ports** connect switches or routers and carry multiple tagged VLANs using `switchport mode trunk`.",
                "Always match the **native VLAN** on both ends of a trunk to avoid security mismatches.",
              ],
            },
            {
              heading: "Inter-VLAN Routing Options",
              bullets: [
                "**Router-on-a-Stick** uses subinterfaces such as `g0/0.10` with `encapsulation dot1Q 10`.",
                "**Layer 3 Multilayer Switches** use `interface vlan <id>` (SVIs) for hardware-accelerated routing.",
              ],
            },
          ],
          important_terms: [
            "Native VLAN",
            "802.1Q Tagging",
            "Access Port",
            "Trunk Port",
            "Router-on-a-Stick",
            "SVI",
          ],
        },
        createdAt: earlier,
        updatedAt: now,
      },
      {
        id: guide2Id,
        userId: demoUserId,
        setId: set2Id,
        title: "Inclusive Interaction Design Principles",
        content: {
          summary:
            "Inclusive design pairs clear **affordances** and **signifiers** with accessible typography, keyboard navigation, and predictable spatial feedback.",
          key_concepts: [
            {
              heading: "Perceivable & Operable Controls",
              bullets: [
                "Maintain **WCAG AA contrast** (`4.5:1` for body text) across both light and dark modes.",
                "Size interactive tap targets comfortably using **Fitts's Law** principles.",
              ],
            },
          ],
          important_terms: ["Affordance", "Signifier", "Fitts's Law", "WCAG AA Contrast"],
        },
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    quizAttempts: [
      {
        id: "attempt-demo-1",
        userId: demoUserId,
        setId: set1Id,
        attemptType: "set_test",
        score: 3,
        total: 7,
        createdAt: earlier,
      },
    ],
    generationJobs: [],
  };
}

export function readDb(): DatabaseState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const seed = buildSeedState();
    fs.writeFileSync(DB_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
  const raw = fs.readFileSync(DB_FILE, "utf8");
  return JSON.parse(raw) as DatabaseState;
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
