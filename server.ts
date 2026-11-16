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
  pastedTextSchema,
  profileUpdateSchema,
  quizAttemptInputSchema,
  saveGeneratedResultSchema,
  signupSchema,
  studySetInputSchema,
  updateGuideSchema,
} from "./src/lib/schemas";
import { cleanPlainText, validateUploadFiles } from "./src/lib/studyLogic";
import {
  countGenerationsToday,
  createSessionToken,
  hashPassword,
  readDb,
  verifyPassword,
  verifySessionToken,
  writeDb,
} from "./server/store";
import { extractFromUploadedFiles } from "./server/extract";
import { generateStudyMaterials } from "./server/ai";
import { registerGoogleAuth } from "./server/google-auth";
import { rateLimit } from "./server/rate-limit";
import { openStudyData } from "./server/study-data";
import { TERMS_VERSION } from "./src/lib/legal";

const COOKIE_NAME = "notedeck_session";
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const DAILY_CAP = Number(process.env.DAILY_GENERATION_LIMIT ?? 5) || 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 2,
  },
});

interface AuthedRequest extends Request {
  userId?: string;
}

function setSessionCookie(res: Response, userId: string, secure = process.env.NODE_ENV === "production"): void {
  const token = createSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME] as string | undefined;
  const userId = verifySessionToken(token);
  if (!userId) {
    res.status(401).json({ error: "Please log in to continue." });
    return;
  }
  const db = readDb();
  const exists = db.users.some((u) => u.id === userId);
  if (!exists) {
    res.clearCookie(COOKIE_NAME);
    res.status(401).json({ error: "Session expired. Please log in again." });
    return;
  }
  req.userId = userId;
  next();
}

async function startServer() {
  const app = express();
  app.use(cookieParser(process.env.SESSION_SECRET));
  app.use(express.json({ limit: "2mb" }));

  // --- Auth Routes ---
  app.post("/api/auth/signup", rateLimit("signup", 10, "Too many signup attempts. Wait a minute and try again."), (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid signup details" });
      return;
    }

    const db = readDb();
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
    writeDb(db);
    setSessionCookie(res, newUser.id);
    res.status(201).json({
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  });

  app.post("/api/auth/login", rateLimit("login", 15, "Too many login attempts. Wait a minute and try again."), (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login details" });
      return;
    }

    const db = readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user?.passwordHash || user.suspended || user.id === "user-demo-student" ||
        !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role ?? "user" },
    });
  });

  registerGoogleAuth(app, setSessionCookie);

  app.post("/api/auth/logout", (_req, res) => {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.json({ ok: true });
  });

  app.get("/api/auth/me", (req: AuthedRequest, res) => {
    const token = req.cookies?.[COOKIE_NAME] as string | undefined;
    const userId = verifySessionToken(token);
    if (!userId) {
      res.json({ user: null });
      return;
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.json({ user: null });
      return;
    }
    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role ?? "user" },
      generationsUsedToday: countGenerationsToday(db, user.id),
      dailyGenerationLimit: DAILY_CAP,
    });
  });

  app.patch("/api/profile", requireAuth, (req: AuthedRequest, res) => {
    const parsed = profileUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid name" });
      return;
    }
    const db = readDb();
    const user = db.users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    user.name = cleanPlainText(parsed.data.name);
    writeDb(db);
    res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role ?? "user" } });
  });

  app.get("/api/account/export", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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
      studySets,
      cards: db.cards.filter((record) => setIds.has(record.setId)),
      studyGuides: db.studyGuides.filter((record) => record.userId === user.id),
      quizAttempts: db.quizAttempts.filter((record) => record.userId === user.id),
      generationJobs: db.generationJobs
        .filter((record) => record.userId === user.id)
        .map(({ id, status, sourceKind, previewResult, resultSetId, resultGuideId, createdAt, updatedAt }) =>
          ({ id, status, sourceKind, previewResult, resultSetId, resultGuideId, createdAt, updatedAt })),
    };

    res.set({
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="notedeck-data-${new Date().toISOString().slice(0, 10)}.json"`,
    });
    res.json(exportData);
  });

  app.delete("/api/account", requireAuth, (req: AuthedRequest, res) => {
    const origin = req.get("origin");
    const host = req.get("host");
    if (!origin || !host || !["http", "https"].some((scheme) => origin === `${scheme}://${host}`)) {
      res.status(403).json({ error: "Invalid request origin." });
      return;
    }

    const parsed = accountDeletionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid deletion confirmation." });
      return;
    }

    const db = readDb();
    const user = db.users.find((record) => record.id === req.userId);
    if (!user) {
      res.status(404).json({ error: "Account not found." });
      return;
    }
    if (parsed.data.email.toLowerCase() !== user.email.toLowerCase()) {
      res.status(400).json({ error: "Enter the email address on your account to confirm deletion." });
      return;
    }

    const setIds = new Set(db.studySets.filter((record) => record.userId === user.id).map((record) => record.id));
    db.users = db.users.filter((record) => record.id !== user.id);
    db.folders = (db.folders ?? []).filter((record) => record.userId !== user.id);
    db.studySets = db.studySets.filter((record) => record.userId !== user.id);
    db.cards = db.cards.filter((record) => !setIds.has(record.setId));
    db.studyGuides = db.studyGuides.filter((record) => record.userId !== user.id);
    db.quizAttempts = db.quizAttempts.filter((record) => record.userId !== user.id);
    db.generationJobs = db.generationJobs.filter((record) => record.userId !== user.id);
    db.adminAudit = (db.adminAudit ?? []).filter((record) => record.actorId !== user.id && record.targetId !== user.id);
    try {
      writeDb(db);
    } catch {
      res.status(500).json({ error: "Account deletion could not be confirmed. Please try again." });
      return;
    }

    res.clearCookie(COOKIE_NAME, { path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    res.json({ ok: true });
  });

  app.get("/api/admin/users", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    if (db.users.find((user) => user.id === req.userId)?.role !== "admin") {
      res.status(403).json({ error: "Administrator access required." });
      return;
    }
    res.set("Cache-Control", "no-store");
    res.json({ users: db.users.map(({ id, name, email, role, suspended, createdAt }) =>
      ({ id, name, email, role: role ?? "user", suspended: suspended ?? false, createdAt })) });
  });

  app.patch("/api/admin/users/:id", requireAuth, (req: AuthedRequest, res) => {
    const origin = req.get("origin");
    const host = req.get("host");
    if (!origin || !host || !["http", "https"].some((scheme) => origin === `${scheme}://${host}`)) {
      res.status(403).json({ error: "Invalid request origin." });
      return;
    }
    const db = readDb();
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
    const { role, suspended } = req.body ?? {};
    const keys = Object.keys(req.body ?? {});
    if (keys.length !== 1 || (keys[0] === "role" && role !== "admin" && role !== "user") ||
        (keys[0] === "suspended" && typeof suspended !== "boolean") ||
        !["role", "suspended"].includes(keys[0])) {
      res.status(400).json({ error: "Invalid account update." });
      return;
    }
    if (target.id === actor.id) {
      res.status(400).json({ error: "You cannot change your own role or access." });
      return;
    }
    if (target.role === "admin" && (role === "user" || suspended === true) &&
        db.users.filter((user) => user.role === "admin" && !user.suspended).length <= 1) {
      res.status(400).json({ error: "At least one active administrator is required." });
      return;
    }
    const action = keys[0] === "role" ? `role:${role}` : (suspended ? "suspended" : "restored");
    if (keys[0] === "role") target.role = role;
    else {
      if (!target.suspended && suspended) target.sessionVersion = (target.sessionVersion ?? 0) + 1;
      target.suspended = suspended;
    }
    (db.adminAudit ??= []).push({ actorId: actor.id, targetId: target.id, action, createdAt: new Date().toISOString() });
    writeDb(db);
    res.json({ ok: true });
  });

  // --- Home & Library Routes ---
  app.get("/api/home", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!);
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
    const { data: db } = openStudyData(req.userId!);
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
    const { data } = openStudyData(req.userId!);
    res.json({ folders: data.folders.map(({ id, name }) => ({ id, name })) });
  });

  function saveFolderName(req: AuthedRequest, res: Response) {
    const parsed = folderNameSchema.safeParse(
      typeof req.body?.name === "string" ? cleanPlainText(req.body.name) : ""
    );
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0].message });
      return;
    }

    const { data, save } = openStudyData(req.userId!);
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
    save();
    res.status(folderId ? 200 : 201).json({ folder: { id: folder.id, name: folder.name } });
  }

  app.post("/api/folders", requireAuth, saveFolderName);
  app.patch("/api/folders/:id", requireAuth, saveFolderName);

  app.patch("/api/folders/:id/items", requireAuth, (req: AuthedRequest, res) => {
    const parsed = folderItemInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Choose a study item." });
      return;
    }

    const { data, save } = openStudyData(req.userId!);
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
      save();
    }
    res.json({ folderId: item.folderId ?? null });
  });

  app.delete("/api/folders/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data, save } = openStudyData(req.userId!);
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
    save();
    res.json({ ok: true });
  });

  // --- Study Sets & Cards ---
  app.post("/api/sets", requireAuth, (req: AuthedRequest, res) => {
    const parsed = studySetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid set fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.status(201).json({ set: newSet });
  });

  app.get("/api/sets/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!);
    const set = db.studySets.find((s) => s.id === req.params.id && s.userId === req.userId);
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const owner = readDb().users.find((u) => u.id === req.userId);
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
      set,
      creatorName: owner?.name ?? "You",
      cards,
      linkedGuideId: linkedGuide?.id ?? null,
      attempts,
    });
  });

  app.patch("/api/sets/:id", requireAuth, (req: AuthedRequest, res) => {
    const parsed = studySetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid set fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.json({ set, cards: updatedCards });
  });

  app.delete("/api/sets/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.json({ ok: true });
  });

  app.post("/api/sets/:id/cards", requireAuth, (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.status(201).json({ card: newCard });
  });

  app.patch("/api/cards/:id", requireAuth, (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.json({ card });
  });

  app.delete("/api/cards/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.json({ ok: true });
  });

  // --- Study Guides ---
  app.get("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!);
    const guide = db.studyGuides.find(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (!guide) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }
    res.json({ guide });
  });

  app.patch("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const parsed = updateGuideSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid guide fields" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.json({ guide });
  });

  app.delete("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!);
    const idx = db.studyGuides.findIndex(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (idx === -1) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }
    db.studyGuides.splice(idx, 1);
    save();
    res.json({ ok: true });
  });

  // --- Quiz Attempts ---
  app.post("/api/attempts", requireAuth, (req: AuthedRequest, res) => {
    const parsed = quizAttemptInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid quiz attempt payload" });
      return;
    }

    const { data: db, save } = openStudyData(req.userId!);
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
    save();

    res.status(201).json({ attempt });
  });

  // --- AI Generation ---
  app.post(
    "/api/generate",
    requireAuth,
    rateLimit("generate", 6, "Too many generation requests. Wait a minute and try again.", (req: AuthedRequest) => req.userId!),
    (req: AuthedRequest, res: Response, next: NextFunction) => {
      const contentType = req.headers["content-type"] ?? "";
      if (contentType.includes("multipart/form-data")) {
        upload.array("files", 2)(req, res, (err: unknown) => {
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
        });
        return;
      }
      next();
    },
    async (req: AuthedRequest, res: Response) => {
      const userId = req.userId!;
      const { data: db, save } = openStudyData(req.userId!);
      if (countGenerationsToday(db, userId) >= DAILY_CAP) {
        res.status(429).json({
          error: `Daily limit reached (${DAILY_CAP} AI generations per day). Create manual sets anytime.`,
        });
        return;
      }

      const uploadedFiles = (req.files as Express.Multer.File[] | undefined) ?? [];
      const isFileUpload = uploadedFiles.length > 0;

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
      } else {
        const parsedText = pastedTextSchema.safeParse(req.body);
        if (!parsedText.success) {
          res.status(400).json({
            error: parsedText.error.issues[0]?.message ?? "Enter notes to generate from.",
          });
          return;
        }
      }

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
      save();

      // Copy buffers and clear multer references right after starting async processing
      const fileInputs = uploadedFiles.map((f) => ({
        originalname: f.originalname,
        buffer: Buffer.from(f.buffer),
      }));
      const rawPastedText = typeof req.body?.text === "string" ? cleanPlainText(req.body.text) : "";

      res.status(202).json({ jobId });

      void (async () => {
        try {
          const sourcePayload = isFileUpload
            ? await extractFromUploadedFiles(fileInputs)
            : { textParts: [rawPastedText], pdfFiles: [] };

          // Release file buffers immediately after extraction
          for (const item of fileInputs) {
            item.buffer.fill(0);
          }

          if (sourcePayload.textParts.length === 0 && sourcePayload.pdfFiles.length === 0) {
            throw new Error("Could not extract readable text from the uploaded file.");
          }

          const result = await generateStudyMaterials(sourcePayload, (stepMessage) => {
            const { data: currentDb, save } = openStudyData(userId);
            const target = currentDb.generationJobs.find((j) => j.id === jobId);
            if (target) {
              target.stepMessage = stepMessage;
              target.updatedAt = new Date().toISOString();
              save();
            }
          });

          const { data: finalDb, save } = openStudyData(userId);
          const target = finalDb.generationJobs.find((j) => j.id === jobId);
          if (target) {
            target.status = "done";
            target.stepMessage = "Ready to review";
            target.previewResult = result;
            target.updatedAt = new Date().toISOString();
            save();
          }
        } catch (err) {
          const { data: finalDb, save } = openStudyData(userId);
          const target = finalDb.generationJobs.find((j) => j.id === jobId);
          if (target) {
            target.status = "failed";
            target.stepMessage = "Failed";
            target.error =
              err instanceof Error ? err.message : "Failed to generate study material.";
            target.updatedAt = new Date().toISOString();
            save();
          }
        }
      })();
    }
  );

  app.get("/api/generate/:id", requireAuth, (req: AuthedRequest, res) => {
    const { data: db } = openStudyData(req.userId!);
    const job = db.generationJobs.find(
      (j) => j.id === req.params.id && j.userId === req.userId
    );
    if (!job) {
      res.status(404).json({ error: "Generation job not found." });
      return;
    }
    res.json({ job });
  });

  app.post("/api/generate/:id/save", requireAuth, (req: AuthedRequest, res) => {
    const { data: db, save } = openStudyData(req.userId!);
    const job = db.generationJobs.find(
      (j) => j.id === req.params.id && j.userId === req.userId
    );
    if (!job) {
      res.status(404).json({ error: "Generation job not found." });
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
    job.updatedAt = now;
    save();

    res.status(201).json({ setId, guideId });
  });

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
      const knownPage = /^\/(?:$|login\/?$|signup\/?$|privacy\/?$|terms\/?$|cookies\/?$|library\/?$|practice-test\/?$|settings\/?$|admin\/?$|sets\/new\/?$|sets\/[^/]+(?:\/edit)?\/?$|guides\/[^/]+\/?$|folders\/[^/]+\/?$)/.test(_req.path);
      res.status(knownPage ? 200 : 404).sendFile(path.join(distDir, "index.html"));
    });
  }

  const port = 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`NoteDeck server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error("Server failed to start:", err);
  process.exit(1);
});
