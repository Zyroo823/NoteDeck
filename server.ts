import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import {
  cardInputSchema,
  accountDeletionSchema,
  folderItemInputSchema,
  folderNameSchema,
  loginSchema,
  markNotificationsReadSchema,
  pastedTextSchema,
  profileUpdateSchema,
  quizAttemptInputSchema,
  saveGeneratedResultSchema,
  signupSchema,
  studyChatInputSchema,
  studyGroupInviteSchema,
  studyGroupNameSchema,
  studySetInputSchema,
  updateGuideSchema,
} from "./src/lib/schemas";
import { cleanPlainText, validateUploadFiles } from "./src/lib/studyLogic";
import {
  countGenerationsToday,
  initializeStorage,
  SESSION_DURATION_MS,
  StoreConflict,
  type DatabaseState,
  type GenerationJobRecord,
  createSessionToken,
  hashPassword,
  readDb,
  verifyPassword,
  verifySessionToken,
  writeDb,
  type StudySetRecord,
  type StudyGroupRecord,
  type UserRecord,
} from "./server/store";
import { extractFromUploadedFiles, UploadContentError, type ExtractedSourcePayload } from "./server/extract";
import { answerAssistantQuestion, answerStudyQuestion, captureStudySource, generateStudyMaterials, isGeminiUnavailable } from "./server/ai";
import { buildAssistantContext } from "./server/assistant-context";
import { getNotificationInbox, markNotificationsRead } from "./server/notifications";
import { assistantRequestSchema } from "./src/chatbot/assistant";
import { registerGoogleAuth } from "./server/google-auth";
import { rateLimit } from "./server/rate-limit";
import { DELETION_COOKIE, SESSION_COOKIE, hasDeletionProof, requireSameOrigin, route, setSecurityHeaders } from "./server/security";
import { openStudyData } from "./server/study-data";
import { MAX_GROUPS_PER_MEMBER, MAX_STUDY_GROUP_MEMBERS, newStudyGroupInviteCode, removeUserFromStudyGroups, studyGroupDetail, studyGroupsForUser, summarizeStudyGroup } from "./server/study-groups";
import { TERMS_VERSION } from "./src/lib/legal";

const COOKIE_NAME = SESSION_COOKIE;
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DAILY_CAP = Number(process.env.DAILY_GENERATION_LIMIT ?? 5) || 5;
const MAX_SAVED_CHAT_TURNS = 100;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 2,
    fields: 0,
    parts: 3,
  },
});

interface AuthedRequest extends Request {
  userId?: string;
  db?: DatabaseState;
}

function setSessionCookie(res: Response, user: UserRecord, secure = process.env.NODE_ENV === "production"): void {
  const token = createSessionToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_MS,
  });
}

const requireAuth = route(async (req: AuthedRequest, res, next) => {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const db = await readDb();
  const userId = verifySessionToken(token, db);
  if (!userId) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }
  req.userId = userId;
  req.db = db;
  next();
});

function publicUser(user: UserRecord) {
  return {
    id: user.id, name: user.name, email: user.email, role: user.role ?? "user",
    hasPassword: Boolean(user.passwordHash), hasGoogle: Boolean(user.googleSubject),
  };
}
function publicStudySet({ studySource, chatTurns, ...set }: StudySetRecord) {
  return set;
}

function isLastActiveAdmin(user: UserRecord, users: UserRecord[]): boolean {
  return user.role === "admin" && !user.suspended &&
    !users.some((other) => other.id !== user.id && other.role === "admin" && !other.suspended);
}

function openChatSet(req: AuthedRequest, res: Response) {
  const { data, save } = openStudyData(req.userId!, req.db!);
  const set = data.studySets.find((record) => record.id === req.params.id);
  res.set("Cache-Control", "private, no-store");
  if (!set) {
    res.status(403).json({ error: "Ask AI is available only to the owner of this set." });
    return null;
  }
  return { data, set, save };
}

async function updateGenerationJob(userId: string, jobId: string, update: Partial<GenerationJobRecord>) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const db = await readDb();
    if (!db.users.some((user) => user.id === userId && !user.suspended)) return false;
    const job = db.generationJobs.find((entry) => entry.id === jobId && entry.userId === userId);
    if (!job || job.status !== "processing") return false;
    Object.assign(job, update, { updatedAt: new Date().toISOString() });
    try {
      await writeDb(db);
      return true;
    } catch (error) {
      if (!(error instanceof StoreConflict) || attempt === 2) throw error;
    }
  }
  return false;
}

async function startServer() {
  if (process.env.NODE_ENV === "production" && (process.env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    throw new Error("Production requires a SESSION_SECRET of at least 32 characters.");
  }
  await initializeStorage();
  const app = express();
  app.disable("x-powered-by");
  app.use(setSecurityHeaders);
  app.use("/api", requireSameOrigin);
  const chatsInProgress = new Set<string>();
  app.use(cookieParser(process.env.SESSION_SECRET));
  app.use(express.json({ limit: "2mb" }));

  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const assetsDirectory = process.env.NODE_ENV === "production" ? "dist" : "public";
    res.sendFile("assetlinks.json", { root: path.resolve(assetsDirectory, ".well-known") });
  });

  const assistantRequests = new Set<string>();
  app.post("/api/assistant", requireAuth,
    rateLimit("assistant", 8, "Too many assistant messages. Try again in a minute.", (req: AuthedRequest) => req.userId!),
    route(async (req: AuthedRequest, res) => {
      res.set("Cache-Control", "private, no-store");
      const parsed = assistantRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Send a message of 1,000 characters or fewer." });
        return;
      }
      const { question, material, history } = parsed.data;
      const userId = req.userId!;
      const context = material ? buildAssistantContext(req.db!, userId, material) : null;
      if (material && context === null) {
        res.status(404).json({ error: "This study material is unavailable. Open a set or guide from your Library." });
        return;
      }
      if (assistantRequests.has(userId)) {
        res.status(429).json({ error: "The assistant is already answering a message. Try again shortly." });
        return;
      }
      assistantRequests.add(userId);
      const controller = new AbortController();
      const abort = () => controller.abort();
      res.once("close", abort);
      try {
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
        const answer = await answerAssistantQuestion(question, context, history, signal);
        if (!controller.signal.aborted) res.json({ answer });
      } catch {
        if (!controller.signal.aborted) {
          res.status(503).json({ error: "The assistant couldn’t respond right now. Try again in a moment." });
        }
      } finally {
        res.off("close", abort);
        assistantRequests.delete(userId);
      }
    }));

  // --- Auth Routes ---
  app.post("/api/auth/signup", rateLimit("signup", 10, "Too many signup attempts. Wait a minute and try again."), route(async (req: AuthedRequest, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid signup details" });
      return;
    }

    const db = req.db ?? await readDb();
    const emailLower = parsed.data.email.toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === emailLower)) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }

    const newUser = {
      id: `user-${crypto.randomUUID()}`,
      name: cleanPlainText(parsed.data.name),
      email: emailLower,
      passwordHash: hashPassword(parsed.data.password),
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: TERMS_VERSION,
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    await writeDb(db);
    setSessionCookie(res, newUser);
    res.status(201).json({
      user: publicUser(newUser),
    });
  }));

  app.post("/api/auth/login", rateLimit("login", 15, "Too many login attempts. Wait a minute and try again."), route(async (req: AuthedRequest, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login details" });
      return;
    }

    const db = req.db ?? await readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user?.passwordHash || user.suspended || user.id === "user-demo-student" ||
        !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    setSessionCookie(res, user);
    res.json({
      user: publicUser(user),
    });
  }));

  registerGoogleAuth(app, setSessionCookie);

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", route(async (req: AuthedRequest, res) => {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    const db = await readDb();
    const userId = verifySessionToken(token, db);
    if (!userId) {
      res.json({ user: null });
      return;
    }
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.json({ user: null });
      return;
    }
    res.json({
      user: publicUser(user),
      generationsUsedToday: countGenerationsToday(db, user.id),
      dailyGenerationLimit: DAILY_CAP,
    });
  }));

  app.patch("/api/profile", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid name" });
      return;
    }
    const db = req.db ?? await readDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    user.name = cleanPlainText(parsed.data.name);
    await writeDb(db);
    res.json({ user: publicUser(user) });
  }));

  app.get("/api/account/export", requireAuth, route(async (req: AuthedRequest, res) => {
    const db = req.db ?? await readDb();
    const user = db.users.find((record) => record.id === req.userId);
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }

    const studySets = db.studySets.filter((record) => record.userId === user.id);
    const setIds = new Set(studySets.map((record) => record.id));
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        name: user.name,
        email: user.email,
        termsVersion: user.termsVersion,
        termsAcceptedAt: user.termsAcceptedAt,
        createdAt: user.createdAt,
      },
      folders: (db.folders ?? []).filter((record) => record.userId === user.id),
      studyGroups: studyGroupsForUser(db, user.id).map(({ id, name, ownerId, createdAt }) => ({ id, name, isOwner: ownerId === user.id, createdAt })),
      studySets,
      cards: db.cards.filter((record) => setIds.has(record.setId)),
      studyGuides: db.studyGuides.filter((record) => record.userId === user.id),
      quizAttempts: db.quizAttempts.filter((record) => record.userId === user.id),
      generationJobs: db.generationJobs
        .filter((record) => record.userId === user.id)
        .map(({ id, status, sourceKind, previewResult, studySource, resultSetId, resultGuideId, createdAt, updatedAt, notificationRead }) =>
          ({ id, status, sourceKind, previewResult, studySource, resultSetId, resultGuideId, createdAt, updatedAt, notificationRead })),
    };

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="notedeck-data-${new Date().toISOString().slice(0, 10)}.json"`,
    });
    res.json(exportData);
  }));

  app.delete("/api/account", requireAuth, rateLimit("delete-account", 5, "Too many deletion attempts. Wait a minute and try again.", (req: AuthedRequest) => req.userId!), route(async (req: AuthedRequest, res) => {

    const parsed = accountDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid deletion confirmation." });
      return;
    }

    const db = req.db ?? await readDb();
    const user = db.users.find((record) => record.id === req.userId);
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    if (parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
      res.status(400).json({ error: "Enter the email address on your account to confirm deletion." });
      return;
    }
    const passwordConfirmed = Boolean(user.passwordHash && parsed.data.password &&
      verifyPassword(parsed.data.password, user.passwordHash));
    if (!passwordConfirmed && !(user.googleSubject && hasDeletionProof(req, user.id))) {
      res.status(403).json({ error: "Confirm your password or verify your linked Google account before deleting your account." });
      return;
    }
    if (isLastActiveAdmin(user, db.users)) {
      res.status(400).json({ error: "Make another account an admin before deleting the last active administrator." });
      return;
    }

    const setIds = new Set(db.studySets.filter((record) => record.userId === user.id).map((record) => record.id));
    db.users = db.users.filter((record) => record.id !== user.id);
    removeUserFromStudyGroups(db, user.id);
    db.folders = (db.folders ?? []).filter((record) => record.userId !== user.id);
    db.studySets = db.studySets.filter((record) => record.userId !== user.id);
    db.cards = db.cards.filter((record) => !setIds.has(record.setId));
    db.studyGuides = db.studyGuides.filter((record) => record.userId !== user.id);
    db.quizAttempts = db.quizAttempts.filter((record) => record.userId !== user.id);
    db.generationJobs = db.generationJobs.filter((record) => record.userId !== user.id);
    db.adminAudit = (db.adminAudit ?? []).filter((record) => record.actorId !== user.id && record.targetId !== user.id);
    await writeDb(db);
    res.clearCookie(DELETION_COOKIE, { path: "/api/account" });

    res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.json({ ok: true });
  }));

  app.get("/api/admin/users", requireAuth, route(async (req: AuthedRequest, res) => {
    const db = req.db ?? await readDb();
    if (db.users.find((user) => user.id === req.userId)?.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json({ users: db.users.map(({ id, name, email, role, suspended, createdAt }) =>
      ({ id, name, email, role: role ?? "user", suspended: suspended ?? false, createdAt })) });
  }));

  app.patch("/api/admin/users/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const db = req.db ?? await readDb();
    const actor = db.users.find((user) => user.id === req.userId);
    if (actor?.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    const target = db.users.find((user) => user.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    const { role, suspended, name } = req.body ?? {};
    const keys = Object.keys(req.body ?? {});
    const field = keys[0];
    if (keys.length !== 1 || !["role", "suspended", "name"].includes(field) ||
        (field === "role" && role !== "admin" && role !== "user") ||
        (field === "suspended" && typeof suspended !== "boolean")) {
      res.status(400).json({ error: "Invalid account update." });
      return;
    }
    if (field !== "name" && target.id === actor.id) {
      res.status(400).json({ error: "You cannot change your own role or access." });
      return;
    }
    if ((role === "user" || suspended === true) && isLastActiveAdmin(target, db.users)) {
      res.status(400).json({ error: "At least one active administrator is required." });
      return;
    }
    let action: string;
    if (field === "name") {
      const parsed = profileUpdateSchema.safeParse({ name: typeof name === "string" ? cleanPlainText(name) : name });
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Enter a valid display name." });
        return;
      }
      target.name = parsed.data.name;
      action = "name:updated";
    } else if (field === "role") {
      target.role = role;
      action = `role:${role}`;
    } else {
      if (!target.suspended && suspended) target.sessionVersion = (target.sessionVersion ?? 0) + 1;
      target.suspended = suspended;
      action = suspended ? "suspended" : "restored";
    }
    (db.adminAudit ??= []).push({ actorId: actor.id, targetId: target.id, action, createdAt: new Date().toISOString() });
    await writeDb(db);
    res.json({ ok: true });
  }));

  // --- Home & Library Routes ---
  app.get("/api/home", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!, req.db!);
    const userId = req.userId!;

    const userSets = db.studySets
      .filter((s) => s.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const userGuides = db.studyGuides
      .filter((g) => g.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const jumpBackIn = userSets.slice(0, 6).map((set) => {
      const cardCount = db.cards.filter((c) => c.setId === set.id).length;
      const latestAttempt = db.quizAttempts
        .filter((a) => a.userId === userId && a.setId === set.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      const lastScorePct = latestAttempt
        ? Math.round((latestAttempt.score / latestAttempt.total) * 100)
        : null;

      return {
        id: set.id,
        title: set.title,
        cardCount,
        lastScorePct,
        updatedAt: set.updatedAt,
      };
    });

    const recents = [
      ...userSets.map((s) => ({
        kind: "set" as const,
        id: s.id,
        title: s.title,
        cardCount: db.cards.filter((c) => c.setId === s.id).length,
        updatedAt: s.updatedAt,
      })),
      ...userGuides.map((g) => ({
        kind: "guide" as const,
        id: g.id,
        title: g.title,
        cardCount: g.content.key_concepts.length,
        updatedAt: g.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    res.json({ jumpBackIn, recents });
  });

  app.get("/api/library", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!, req.db!);
    const userId = req.userId!;
    const q = cleanPlainText(typeof req.query.q === "string" ? req.query.q : "").toLowerCase();

    const sets = db.studySets
      .filter((s) => s.userId === userId && (!q || s.title.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((s) => ({
        id: s.id,
        folderId: s.folderId ?? null,
        title: s.title,
        sourceType: s.sourceType,
        cardCount: db.cards.filter((c) => c.setId === s.id).length,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));

    const guides = db.studyGuides
      .filter((g) => g.userId === userId && (!q || g.title.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((g) => ({
        id: g.id,
        folderId: g.folderId ?? null,
        setId: g.setId,
        title: g.title,
        conceptCount: g.content.key_concepts.length,
        termCount: g.content.important_terms.length,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }));

    res.json({ sets, guides });
  });

  // --- Folders ---
  app.get("/api/folders", requireAuth, (req: AuthedRequest, res) => {
    const { data } = openStudyData(req.userId!, req.db!);
    res.json({ folders: data.folders.map(({ id, name }) => ({ id, name })) });
  });

  const saveFolderName = route(async (req: AuthedRequest, res) => {
    const parsed = folderNameSchema.safeParse(
      typeof req.body?.name === "string" ? cleanPlainText(req.body.name) : ""
    );
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { data, save } = openStudyData(req.userId!, req.db!);
    const folderId = req.params.id;
    const folder = folderId
      ? data.folders.find((entry) => entry.id === folderId)
      : { id: `folder-${crypto.randomUUID()}`, userId: req.userId!, name: parsed.data };
    if (!folder) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    folder.name = parsed.data;
    if (!folderId) data.folders.push(folder);
    await save();
    res.status(folderId ? 200 : 201).json({ folder: { id: folder.id, name: folder.name } });
  });

  app.post("/api/folders", requireAuth, saveFolderName);
  app.patch("/api/folders/:id", requireAuth, saveFolderName);

  app.patch("/api/folders/:id/items", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = folderItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a study item." });
      return;
    }

    const { data, save } = openStudyData(req.userId!, req.db!);
    const folder = data.folders.find((entry) => entry.id === req.params.id);
    const { kind, id, add } = parsed.data;
    const rows = kind === "set" ? data.studySets : data.studyGuides;
    const item = rows.find((entry) => entry.id === id);
    if (!folder || !item) {
      res.status(404).json({ error: "Folder or study item not found." });
      return;
    }
    if (add && item.folderId && item.folderId !== folder.id) {
      res.status(409).json({ error: "This item is already in another folder." });
      return;
    }
    if (add || item.folderId === folder.id) {
      item.folderId = add ? folder.id : null;
      await save();
    }
    res.json({ folderId: item.folderId ?? null });
  }));

  app.delete("/api/folders/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const { data, save } = openStudyData(req.userId!, req.db!);
    const folderId = req.params.id;
    const index = data.folders.findIndex((entry) => entry.id === folderId);
    if (index === -1) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    for (const item of [...data.studySets, ...data.studyGuides]) {
      if (item.folderId === folderId) item.folderId = null;
    }
    data.folders.splice(index, 1);
    await save();
    res.json({ ok: true });
  }));

  // --- Study Groups ---
  const studyGroupWriteLimit = rateLimit("study-group-write", 20, "Too many group changes. Try again in a minute.", (req: AuthedRequest) => req.userId!);
  const studyGroupsPath = "/api/study-groups";

  app.use(studyGroupsPath, requireAuth, (_req, res, next) => {
    res.set("Cache-Control", "private, no-store");
    next();
  });

  function findMemberGroup(req: AuthedRequest) {
    return studyGroupsForUser(req.db!, req.userId!).find(({ id }) => id === req.params.id);
  }

  app.get(studyGroupsPath, (req: AuthedRequest, res) => {
    const groups = studyGroupsForUser(req.db!, req.userId!).map((group) => summarizeStudyGroup(group, req.userId!));
    res.json({ groups });
  });

  app.post(studyGroupsPath, studyGroupWriteLimit, route(async (req: AuthedRequest, res) => {
    const parsed = studyGroupNameSchema.safeParse({ name: typeof req.body?.name === "string" ? cleanPlainText(req.body.name) : undefined });
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a group name with 2 to 60 characters." });
      return;
    }
    const db = req.db!;
    const userId = req.userId!;
    if (studyGroupsForUser(db, userId).length >= MAX_GROUPS_PER_MEMBER) {
      res.status(409).json({ error: `You can belong to up to ${MAX_GROUPS_PER_MEMBER} study groups.` });
      return;
    }
    const group: StudyGroupRecord = {
      id: `group-${crypto.randomUUID()}`,
      name: parsed.data.name,
      ownerId: userId,
      memberIds: [userId],
      inviteCode: newStudyGroupInviteCode(db),
      createdAt: new Date().toISOString(),
    };
    (db.studyGroups ??= []).unshift(group);
    await writeDb(db);
    res.status(201).json({ groupId: group.id });
  }));

  app.post(`${studyGroupsPath}/join`, studyGroupWriteLimit, route(async (req: AuthedRequest, res) => {
    const parsed = studyGroupInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter the 16-character invite code." });
      return;
    }
    const db = req.db!;
    const userId = req.userId!;
    const group = db.studyGroups?.find(({ inviteCode }) => inviteCode === parsed.data.code);
    if (!group) {
      res.status(404).json({ error: "This invite code is invalid. Ask the group owner for the current code." });
      return;
    }
    if (!group.memberIds.includes(userId)) {
      if (studyGroupsForUser(db, userId).length >= MAX_GROUPS_PER_MEMBER) {
        res.status(409).json({ error: `You can belong to up to ${MAX_GROUPS_PER_MEMBER} study groups.` });
        return;
      }
      if (group.memberIds.length >= MAX_STUDY_GROUP_MEMBERS) {
        res.status(409).json({ error: "This study group is full." });
        return;
      }
      group.memberIds.push(userId);
      await writeDb(db);
    }
    res.json({ groupId: group.id });
  }));

  app.get(`${studyGroupsPath}/:id`, (req: AuthedRequest, res) => {
    const group = findMemberGroup(req);
    if (!group) {
      res.status(404).json({ error: "Study group not found." });
      return;
    }
    res.json({ group: studyGroupDetail(req.db!, group, req.userId!) });
  });

  app.post(`${studyGroupsPath}/:id/invite-code`, studyGroupWriteLimit, route(async (req: AuthedRequest, res) => {
    const group = findMemberGroup(req);
    if (!group || group.ownerId !== req.userId) {
      res.status(404).json({ error: "Study group not found or you are not its owner." });
      return;
    }
    group.inviteCode = newStudyGroupInviteCode(req.db!);
    await writeDb(req.db!);
    res.json({ group: studyGroupDetail(req.db!, group, req.userId!) });
  }));

  app.delete(`${studyGroupsPath}/:id/membership`, studyGroupWriteLimit, route(async (req: AuthedRequest, res) => {
    const group = findMemberGroup(req);
    if (!group) {
      res.status(404).json({ error: "Study group not found." });
      return;
    }
    if (group.ownerId === req.userId) {
      res.status(409).json({ error: "Owners can delete their group from group settings." });
      return;
    }
    group.memberIds = group.memberIds.filter((id) => id !== req.userId);
    await writeDb(req.db!);
    res.status(204).end();
  }));

  app.delete(`${studyGroupsPath}/:id`, studyGroupWriteLimit, route(async (req: AuthedRequest, res) => {
    const group = findMemberGroup(req);
    if (!group || group.ownerId !== req.userId) {
      res.status(404).json({ error: "Study group not found or you are not its owner." });
      return;
    }
    const db = req.db!;
    db.studyGroups = db.studyGroups?.filter(({ id }) => id !== group.id);
    await writeDb(db);
    res.status(204).end();
  }));

  // --- Study Sets & Cards ---
  app.post("/api/sets", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = studySetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid set fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const now = new Date().toISOString();
    const setId = `set-${crypto.randomUUID()}`;

    const newSet = {
      id: setId,
      userId: req.userId!,
      folderId: null,
      title: cleanPlainText(parsed.data.title),
      sourceType: "manual" as const,
      createdAt: now,
      updatedAt: now,
    };

    const newCards = parsed.data.cards.map((c, idx) => ({
      id: `card-${crypto.randomUUID()}`,
      setId,
      term: cleanPlainText(c.term),
      definition: cleanPlainText(c.definition),
      position: idx,
      isStarred: false,
      masteryStatus: "new" as const,
    }));

    db.studySets.push(newSet);
    db.cards.push(...newCards);
    await save();

    res.status(201).json({ set: newSet });
  }));

  app.get("/api/sets/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!, req.db!);
    const set = db.studySets.find((s) => s.id === req.params.id && s.userId === req.userId);
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const owner = req.db!.users.find((u) => u.id === req.userId);
    const cards = db.cards
      .filter((c) => c.setId === set.id)
      .sort((a, b) => a.position - b.position);

    const linkedGuide = db.studyGuides.find(
      (g) => g.setId === set.id && g.userId === req.userId
    );

    const attempts = db.quizAttempts
      .filter((a) => a.setId === set.id && a.userId === req.userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    res.json({
      set: publicStudySet(set),
      creatorName: owner?.name ?? "You",
      cards,
      linkedGuideId: linkedGuide?.id ?? null,
      attempts,
    });
  }));

  app.patch("/api/sets/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = studySetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid set fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const set = db.studySets.find((s) => s.id === req.params.id && s.userId === req.userId);
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    set.title = cleanPlainText(parsed.data.title);
    set.updatedAt = new Date().toISOString();

    db.cards = db.cards.filter((c) => c.setId !== set.id);
    const updatedCards = parsed.data.cards.map((c, idx) => ({
      id: `card-${crypto.randomUUID()}`,
      setId: set.id,
      term: cleanPlainText(c.term),
      definition: cleanPlainText(c.definition),
      position: idx,
      isStarred: false,
      masteryStatus: "new" as const,
    }));
    db.cards.push(...updatedCards);
    await save();

    res.json({ set: publicStudySet(set), cards: updatedCards });
  }));

  app.delete("/api/sets/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const idx = db.studySets.findIndex(
      (s) => s.id === req.params.id && s.userId === req.userId
    );
    if (idx === -1) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const setId = db.studySets[idx].id;
    db.studySets.splice(idx, 1);
    db.cards = db.cards.filter((c) => c.setId !== setId);
    db.quizAttempts = db.quizAttempts.filter((a) => a.setId !== setId);
    for (const guide of db.studyGuides) {
      if (guide.setId === setId) {
        guide.setId = null;
      }
    }
    await save();

    res.json({ ok: true });
  }));

  app.route("/api/sets/:id/chat")
    .get(requireAuth, (req: AuthedRequest, res) => {
      const chat = openChatSet(req, res);
      if (!chat) return;
      res.json({
        turns: chat.set.chatTurns ?? [],
        source: chat.set.studySource ? "notes" : "cards",
        sourceTruncated: chat.set.studySource?.truncated ?? false,
      });
    })
    .post(
      requireAuth,
      rateLimit("study-chat", 10, "Too many questions. Wait a minute and try again.", (req: AuthedRequest) => req.userId!),
      route(async (req: AuthedRequest, res) => {
        const chat = openChatSet(req, res);
        if (!chat) return;
        const { data, set } = chat;
        const parsed = studyChatInputSchema.safeParse(req.body);
        const question = parsed.success ? cleanPlainText(parsed.data.question) : "";
        if (!parsed.success || !question) {
          res.status(400).json({
            error: parsed.success ? "Enter a question." : parsed.error.issues[0]?.message ?? "Invalid question.",
          });
          return;
        }
        const { requestId } = parsed.data;
        const turns = set.chatTurns ?? [];
        const savedTurn = turns.find((turn) => turn.id === requestId);
        if (savedTurn) {
          if (savedTurn.question !== question) {
            res.status(409).json({ error: "This request has already been used for a different question." });
            return;
          }
          res.json({ turns });
          return;
        }
        if (chatsInProgress.has(set.id)) {
          res.status(409).json({ error: "An answer is already in progress for this set. Try again in a moment." });
          return;
        }
        if (turns.length >= MAX_SAVED_CHAT_TURNS) {
          res.status(409).json({ error: "This chat is full. Clear it to start a new conversation." });
          return;
        }

        const cards = data.cards
          .filter((card) => card.setId === set.id)
          .sort((a, b) => a.position - b.position);
        const terms = cards.map((card) => card.term);
        const source = set.studySource?.text ?? cards
          .map((card) => `${card.term}: ${card.definition}`)
          .join("\n\n");
        if (!source.trim()) {
          res.status(422).json({ error: "Add a flashcard to give Ask AI some material to use." });
          return;
        }

        chatsInProgress.add(set.id);
        try {
          let answer: string;
          try {
            answer = await answerStudyQuestion(source, terms, question, turns);
          } catch {
            res.status(502).json({ error: "Could not get an answer from Gemini. Please try again." });
            return;
          }

          // The account or set may have been removed while Gemini was answering.
          req.db = await readDb();
          if (verifySessionToken(req.cookies?.[COOKIE_NAME], req.db) !== req.userId) {
            res.status(401).json({ error: "Your session expired. Please log in again." });
            return;
          }
          const latest = openChatSet(req, res);
          if (!latest) return;
          const updatedTurns = [
            ...(latest.set.chatTurns ?? []),
            { id: requestId, question, answer, createdAt: new Date().toISOString() },
          ];
          latest.set.chatTurns = updatedTurns;
          await latest.save();
          res.json({ turns: updatedTurns });
        } catch (error) {
          if (error instanceof StoreConflict) throw error;
          res.status(500).json({ error: "Could not save the answer. Please try again." });
        } finally {
          chatsInProgress.delete(set.id);
        }
      }),
    )
    .delete(requireAuth, route(async (req: AuthedRequest, res) => {
      const chat = openChatSet(req, res);
      if (!chat) return;
      if (chatsInProgress.has(chat.set.id)) {
        res.status(409).json({ error: "Wait for the current answer before clearing the chat." });
        return;
      }
      if (chat.set.chatTurns?.length) {
        delete chat.set.chatTurns;
        await chat.save();
      }
      res.json({ turns: [] });
    }));

  app.post("/api/sets/:id/cards", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const set = db.studySets.find((s) => s.id === req.params.id && s.userId === req.userId);
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const existingCount = db.cards.filter((c) => c.setId === set.id).length;
    const newCard = {
      id: `card-${crypto.randomUUID()}`,
      setId: set.id,
      term: cleanPlainText(parsed.data.term),
      definition: cleanPlainText(parsed.data.definition),
      position: existingCount,
      isStarred: false,
      masteryStatus: "new" as const,
    };

    db.cards.push(newCard);
    set.updatedAt = new Date().toISOString();
    await save();

    res.status(201).json({ card: newCard });
  }));

  app.patch("/api/cards/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const card = db.cards.find((c) => c.id === req.params.id);
    if (!card) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    const parentSet = db.studySets.find((s) => s.id === card.setId && s.userId === req.userId);
    if (!parentSet) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    card.term = cleanPlainText(parsed.data.term);
    card.definition = cleanPlainText(parsed.data.definition);
    parentSet.updatedAt = new Date().toISOString();
    await save();

    res.json({ card });
  }));

  app.delete("/api/cards/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const cardIdx = db.cards.findIndex((c) => c.id === req.params.id);
    if (cardIdx === -1) {
      res.status(404).json({ error: "Card not found." });
      return;
    }

    const card = db.cards[cardIdx];
    const parentSet = db.studySets.find((s) => s.id === card.setId && s.userId === req.userId);
    if (!parentSet) {
      res.status(403).json({ error: "Access denied." });
      return;
    }

    db.cards.splice(cardIdx, 1);
    parentSet.updatedAt = new Date().toISOString();
    await save();

    res.json({ ok: true });
  }));

  // --- Study Guides ---
  app.get("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!, req.db!);
    const guide = db.studyGuides.find(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (!guide) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }
    res.json({ guide });
  });

  app.patch("/api/guides/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = updateGuideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid guide fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const guide = db.studyGuides.find(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (!guide) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }

    guide.title = cleanPlainText(parsed.data.title);
    guide.content = {
      summary: cleanPlainText(parsed.data.content.summary),
      key_concepts: parsed.data.content.key_concepts.map((kc) => ({
        heading: cleanPlainText(kc.heading),
        bullets: kc.bullets.map((b) => cleanPlainText(b)),
      })),
      important_terms: parsed.data.content.important_terms.map((t) => cleanPlainText(t)),
    };
    guide.updatedAt = new Date().toISOString();
    await save();

    res.json({ guide });
  }));

  app.delete("/api/guides/:id", requireAuth, route(async (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const idx = db.studyGuides.findIndex(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (idx === -1) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }
    db.studyGuides.splice(idx, 1);
    await save();
    res.json({ ok: true });
  }));

  app.get("/api/notifications", requireAuth, (req: AuthedRequest, res) => {
    res.set("Cache-Control", "private, no-store");
    res.json(getNotificationInbox(req.db!, req.userId!));
  });

  app.patch("/api/notifications/read", requireAuth, route(async (req: AuthedRequest, res) => {
    res.set("Cache-Control", "private, no-store");
    const parsed = markNotificationsReadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Select notifications to mark as read." });
      return;
    }
    const db = req.db!;
    const userId = req.userId!;
    if (markNotificationsRead(db, userId, parsed.data.ids)) await writeDb(db);
    res.json(getNotificationInbox(db, userId));
  }));

  // --- Quiz Attempts ---
  app.post("/api/attempts", requireAuth, route(async (req: AuthedRequest, res) => {
    const parsed = quizAttemptInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid quiz attempt payload" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const set = db.studySets.find(
      (s) => s.id === parsed.data.setId && s.userId === req.userId
    );
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const attempt = {
      id: `attempt-${crypto.randomUUID()}`,
      userId: req.userId!,
      setId: set.id,
      attemptType: "set_test" as const,
      score: Math.min(parsed.data.score, parsed.data.total),
      total: parsed.data.total,
      createdAt: new Date().toISOString(),
    };

    db.quizAttempts.push(attempt);
    set.updatedAt = new Date().toISOString();
    await save();

    res.status(201).json({ attempt });
  }));

  // --- AI Generation ---
  const uploadRateLimit = rateLimit("upload", 4, "Too many file uploads. Wait a minute and try again.", (req: AuthedRequest) => req.userId!);
  app.post(
    "/api/generate",
    requireAuth,
    rateLimit("generate", 6, "Too many generation requests. Wait a minute and try again.", (req: AuthedRequest) => req.userId!),
    (req: AuthedRequest, res: Response, next: NextFunction) => {
      const contentType = req.headers["content-type"] ?? "";
      if (contentType.includes("multipart/form-data")) {
        uploadRateLimit(req, res, () => upload.array("files", 2)(req, res, (err: unknown) => {
          if (err) {
            const msg =
              err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
                ? "File exceeds the 25MB per-file limit."
                : err instanceof multer.MulterError && err.code === "LIMIT_FILE_COUNT"
                  ? "Upload up to 2 files at a time."
                  : "Invalid file upload.";
            res.status(400).json({ error: msg });
            return;
          }
          next();
        }));
        return;
      }
      next();
    },
    route(async (req: AuthedRequest, res) => {
      const userId = req.userId!;
      if (countGenerationsToday(req.db!, userId) >= DAILY_CAP) {
        res.status(429).json({
          error: `Daily limit reached (${DAILY_CAP} AI generations per day). Create manual sets anytime.`,
        });
        return;
      }

      const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
      const isFileUpload = uploadedFiles.length > 0;
      let sourcePayload: ExtractedSourcePayload;

      if (isFileUpload) {
        const validation = validateUploadFiles(
          uploadedFiles.map((f) => ({
            name: f.originalname,
            type: f.mimetype,
            size: f.size,
          }))
        );
        if (!validation.valid) {
          res.status(400).json({ error: validation.error });
          return;
        }
        try {
          sourcePayload = await extractFromUploadedFiles(uploadedFiles);
        } catch (error) {
          res.status(400).json({ error: error instanceof UploadContentError ? error.message : "This file is invalid or cannot be read." });
          return;
        } finally {
          for (const file of uploadedFiles) file.buffer.fill(0);
        }
        req.db = await readDb();
        if (verifySessionToken(req.cookies?.[COOKIE_NAME], req.db) !== userId) {
          res.status(401).json({ error: "Session expired. Please log in again." });
          return;
        }
        if (countGenerationsToday(req.db, userId) >= DAILY_CAP) {
          res.status(429).json({ error: "Your daily generation limit has been reached." });
          return;
        }
      } else {
        const parsedText = pastedTextSchema.safeParse(req.body);
        if (!parsedText.success) {
          res.status(400).json({
            error: parsedText.error.issues[0]?.message ?? "Enter notes to generate from.",
          });
          return;
        }
        sourcePayload = { textParts: [cleanPlainText(parsedText.data.text)], pdfFiles: [] };
      }

      if (!sourcePayload.textParts.some(Boolean) && !sourcePayload.pdfFiles.length) {
        res.status(400).json({ error: "Could not find readable text in the source." });
        return;
      }
      const { data: db, save } = openStudyData(userId, req.db!);
      const now = new Date().toISOString();
      const jobId = `job-${crypto.randomUUID()}`;
      const job = {
        id: jobId,
        userId,
        status: "processing" as const,
        stepMessage: isFileUpload ? "Reading your file..." : "Reading your notes...",
        sourceKind: (isFileUpload ? "file" : "text") as "file" | "text",
        previewResult: null,
        resultSetId: null,
        resultGuideId: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };

      db.generationJobs.push(job);
      await save();

      res.status(202).json({ jobId });

      void (async () => {
        try {
          const studySource = await captureStudySource(sourcePayload);
          const result = await generateStudyMaterials(sourcePayload, async (stepMessage) => {
            if (!await updateGenerationJob(userId, jobId, { stepMessage })) throw new Error("Generation was cancelled.");
          });
          await updateGenerationJob(userId, jobId, { status: "done", stepMessage: "Ready to review", previewResult: result, studySource });
        } catch (error) {
          await updateGenerationJob(userId, jobId, {
            status: "failed", stepMessage: "Failed",
            error: isGeminiUnavailable(error)
              ? "Gemini is busy right now. Wait a moment and try again."
              : "Could not generate study material. Check your source and try again.",
          });
        }
      })().catch(() => console.error("Could not save generation status."));
    })
  );

  app.get("/api/generate/:id", requireAuth, rateLimit("generate-status", 120, "Too many generation status requests.", (req: AuthedRequest) => req.userId!), (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!, req.db!);
    const job = db.generationJobs.find(
      (j) => j.id === req.params.id && j.userId === req.userId
    );
    if (!job) {
      res.status(404).json({ error: "Generation job not found." });
      return;
    }
    const { studySource, ...previewJob } = job;
    res.json({ job: previewJob });
  });

  app.post("/api/generate/:id/save", requireAuth, rateLimit("generate-save", 10, "Too many generation saves.", (req: AuthedRequest) => req.userId!), route(async (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!, req.db!);
    const job = db.generationJobs.find(
      (j) => j.id === req.params.id && j.userId === req.userId
    );
    if (!job) {
      res.status(404).json({ error: "Generation job not found." });
      return;
    }
    if (job.status !== "done") {
      res.status(409).json({ error: "Wait for generation to finish before saving." });
      return;
    }
    if (job.resultSetId && job.resultGuideId) {
      if (!db.studySets.some((set) => set.id === job.resultSetId)) {
        res.status(409).json({ error: "The set from this generation was deleted. Generate again to create a new one." });
        return;
      }
      res.json({ setId: job.resultSetId, guideId: job.resultGuideId });
      return;
    }

    const parsed = saveGeneratedResultSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid generated content" });
      return;
    }

    const now = new Date().toISOString();
    const setId = `set-${crypto.randomUUID()}`;
    const guideId = `guide-${crypto.randomUUID()}`;
    const cleanTitle = cleanPlainText(parsed.data.title);

    db.studySets.push({
      id: setId,
      userId: req.userId!,
      folderId: null,
      title: cleanTitle,
      sourceType: "ai",
      studySource: job.studySource,
      createdAt: now,
      updatedAt: now,
    });

    db.cards.push(
      ...parsed.data.cards.map((c, idx) => ({
        id: `card-${crypto.randomUUID()}`,
        setId,
        term: cleanPlainText(c.term),
        definition: cleanPlainText(c.definition),
        position: idx,
        isStarred: false,
        masteryStatus: "new" as const,
      }))
    );

    db.studyGuides.push({
      id: guideId,
      userId: req.userId!,
      setId,
      title: `${cleanTitle} Study Guide`,
      content: {
        summary: cleanPlainText(parsed.data.study_guide.summary),
        key_concepts: parsed.data.study_guide.key_concepts.map((kc) => ({
          heading: cleanPlainText(kc.heading),
          bullets: kc.bullets.map((b) => cleanPlainText(b)),
        })),
        important_terms: parsed.data.study_guide.important_terms.map((t) => cleanPlainText(t)),
      },
      createdAt: now,
      updatedAt: now,
    });

    job.resultSetId = setId;
    job.resultGuideId = guideId;
    delete job.studySource;
    job.updatedAt = now;
    await save();

    res.status(201).json({ setId, guideId });
  }));

  // --- Vite / Static Frontend ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.use("/api", (_req, res) => {
      res.status(404).json({ error: "API route not found." });
    });
    app.get("*", (_req, res) => {
      const knownPage = /^\/(?:$|login\/?$|signup\/?$|privacy\/?$|terms\/?$|cookies\/?$|library\/?$|practice-test\/?$|settings\/?$|help\/?$|notifications\/?$|admin\/?$|study-groups(?:\/[^/]+)?\/?$|sets\/new\/?$|sets\/[^/]+(?:\/edit)?\/?$|guides\/[^/]+\/?$|folders\/[^/]+\/?$)/.test(_req.path);
      res.status(knownPage ? 200 : 404).sendFile(path.join(distDir, "index.html"));
    });
  }

  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) { next(error); return; }
    if (error instanceof StoreConflict) {
      res.status(409).json({ error: error.message });
      return;
    }
    const status = (error as { status?: number } | null)?.status;
    if (status === 400 || status === 413) {
      res.status(status).json({ error: status === 413 ? "Request is too large." : "Invalid request." });
      return;
    }
    res.status(500).json({ error: "Something went wrong. Please try again." });
  });

  const port = 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`NoteDeck server running on http://localhost:${port}`);
  });
}

startServer().catch((error: unknown) => {
  const code = error instanceof Error && "code" in error && typeof error.code === "string" &&
    /^[A-Z0-9_]{3,40}$/.test(error.code) ? error.code : null;
  console.error(`NoteDeck failed to start${code ? ` (${code})` : ""}. Check the server environment and database setup.`);
  process.exit(1);
});
