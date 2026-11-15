import "dotenv/config";
import crypto from "node:crypto";
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import path from "node:path";
import {
  cardInputSchema,
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
  checkRateLimit,
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

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    return fwd.split(",")[0].trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}

function setSessionCookie(res: Response, userId: string): void {
  const token = createSessionToken(userId);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
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
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  // --- Auth Routes ---
  app.post("/api/auth/signup", (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`signup:${ip}`, 10, 60 * 1000)) {
      res.status(429).json({ error: "Too many signup attempts. Wait a minute and try again." });
      return;
    }

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
      createdAt: new Date().toISOString(),
    };

    db.users.push(newUser);
    writeDb(db);
    setSessionCookie(res, newUser.id);
    res.status(201).json({
      user: { id: newUser.id, name: newUser.name, email: newUser.email },
    });
  });

  app.post("/api/auth/login", (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`login:${ip}`, 15, 60 * 1000)) {
      res.status(429).json({ error: "Too many login attempts. Wait a minute and try again." });
      return;
    }

    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid login details" });
      return;
    }

    const db = readDb();
    const user = db.users.find((u) => u.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      res.status(401).json({ error: "Incorrect email or password." });
      return;
    }

    setSessionCookie(res, user.id);
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  });

  app.post("/api/auth/demo", (_req, res) => {
    const db = readDb();
    const demoUser = db.users.find((u) => u.email === "demo@notedeck.app");
    if (!demoUser) {
      res.status(404).json({ error: "Demo account not found" });
      return;
    }
    setSessionCookie(res, demoUser.id);
    res.json({
      user: { id: demoUser.id, name: demoUser.name, email: demoUser.email },
    });
  });

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
      user: { id: user.id, name: user.name, email: user.email },
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
    res.json({ user: { id: user.id, name: user.name, email: user.email } });
  });

  // --- Home & Library Routes ---
  app.get("/api/home", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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
    const db = readDb();
    const userId = req.userId!;
    const q = cleanPlainText(typeof req.query.q === "string" ? req.query.q : "").toLowerCase();

    const sets = db.studySets
      .filter((s) => s.userId === userId && (!q || s.title.toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((s) => ({
        id: s.id,
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
        setId: g.setId,
        title: g.title,
        conceptCount: g.content.key_concepts.length,
        termCount: g.content.important_terms.length,
        createdAt: g.createdAt,
        updatedAt: g.updatedAt,
      }));

    res.json({ sets, guides });
  });

  // --- Study Sets & Cards ---
  app.post("/api/sets", requireAuth, (req: AuthedRequest, res) => {
    const parsed = studySetInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid set fields" });
      return;
    }

    const db = readDb();
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
    writeDb(db);

    res.status(201).json({ set: newSet });
  });

  app.get("/api/sets/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const set = db.studySets.find((s) => s.id === req.params.id && s.userId === req.userId);
    if (!set) {
      res.status(404).json({ error: "Study set not found." });
      return;
    }

    const owner = db.users.find((u) => u.id === set.userId);
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

    const db = readDb();
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
    writeDb(db);

    res.json({ set, cards: updatedCards });
  });

  app.delete("/api/sets/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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
    writeDb(db);

    res.json({ ok: true });
  });

  app.post("/api/sets/:id/cards", requireAuth, (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const db = readDb();
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
    writeDb(db);

    res.status(201).json({ card: newCard });
  });

  app.patch("/api/cards/:id", requireAuth, (req: AuthedRequest, res) => {
    const parsed = cardInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid card" });
      return;
    }

    const db = readDb();
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
    writeDb(db);

    res.json({ card });
  });

  app.delete("/api/cards/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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
    writeDb(db);

    res.json({ ok: true });
  });

  // --- Study Guides ---
  app.get("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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

    const db = readDb();
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
    writeDb(db);

    res.json({ guide });
  });

  app.delete("/api/guides/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
    const idx = db.studyGuides.findIndex(
      (g) => g.id === req.params.id && g.userId === req.userId
    );
    if (idx === -1) {
      res.status(404).json({ error: "Study guide not found." });
      return;
    }
    db.studyGuides.splice(idx, 1);
    writeDb(db);
    res.json({ ok: true });
  });

  // --- Quiz Attempts ---
  app.post("/api/attempts", requireAuth, (req: AuthedRequest, res) => {
    const parsed = quizAttemptInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid quiz attempt payload" });
      return;
    }

    const db = readDb();
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
    writeDb(db);

    res.status(201).json({ attempt });
  });

  // --- AI Generation ---
  app.post(
    "/api/generate",
    requireAuth,
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
      if (!checkRateLimit(`generate:${userId}`, 6, 60 * 1000)) {
        res.status(429).json({ error: "Too many generation requests. Wait a minute and try again." });
        return;
      }

      const db = readDb();
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
      writeDb(db);

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
            const currentDb = readDb();
            const target = currentDb.generationJobs.find((j) => j.id === jobId);
            if (target) {
              target.stepMessage = stepMessage;
              target.updatedAt = new Date().toISOString();
              writeDb(currentDb);
            }
          });

          const finalDb = readDb();
          const target = finalDb.generationJobs.find((j) => j.id === jobId);
          if (target) {
            target.status = "done";
            target.stepMessage = "Ready to review";
            target.previewResult = result;
            target.updatedAt = new Date().toISOString();
            writeDb(finalDb);
          }
        } catch (err) {
          const finalDb = readDb();
          const target = finalDb.generationJobs.find((j) => j.id === jobId);
          if (target) {
            target.status = "failed";
            target.stepMessage = "Failed";
            target.error =
              err instanceof Error ? err.message : "Failed to generate study material.";
            target.updatedAt = new Date().toISOString();
            writeDb(finalDb);
          }
        }
      })();
    }
  );

  app.get("/api/generate/:id", requireAuth, (req: AuthedRequest, res) => {
    const db = readDb();
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
    const db = readDb();
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
    writeDb(db);

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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
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
