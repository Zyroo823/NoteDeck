import crypto from "node:crypto";
import type { Express, Response } from "express";
import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from "google-auth-library";
import { cleanPlainText } from "../src/lib/studyLogic";
import { TERMS_VERSION } from "../src/lib/legal";
import { readDb, writeDb, type DatabaseState, type UserRecord } from "./store";
import { rateLimit } from "./rate-limit";

const AUTH_PATH = "/api/auth/google";
const CALLBACK_PATH = `${AUTH_PATH}/callback`;
const OAUTH_COOKIE = "notedeck_google_login";
const FLOW_DURATION_MS = 10 * 60 * 1000;

export function bootstrapVerifiedAdmin(db: DatabaseState, user: UserRecord, verifiedEmail: string, configuredEmail: string | undefined): boolean {
  const targetEmail = configuredEmail?.trim().toLowerCase();
  if (!targetEmail || verifiedEmail !== targetEmail || user.email.toLowerCase() !== verifiedEmail ||
      !user.googleSubject || user.suspended || user.role === "admin" ||
      db.users.some((record) => record.role === "admin" && !record.suspended)) {
    return false;
  }
  user.role = "admin";
  return true;
}

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret || (process.env.SESSION_SECRET?.trim().length ?? 0) < 32) {
    return null;
  }

  let redirect: URL;
  try {
    redirect = new URL(
      process.env.GOOGLE_OAUTH_REDIRECT_URI || `http://localhost:3000${CALLBACK_PATH}`
    );
  } catch {
    return null;
  }
  if (redirect.pathname !== CALLBACK_PATH || redirect.search || redirect.hash ||
      redirect.username || redirect.password) {
    return null;
  }
  const secure = redirect.protocol === "https:";
  if (!secure && (redirect.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(redirect.hostname))) {
    return null;
  }
  return { clientId, client: new OAuth2Client(clientId, clientSecret, redirect.href), secure };
}

export function registerGoogleAuth(
  app: Express,
  setSessionCookie: (res: Response, userId: string, secure: boolean) => void
): void {
  const config = getGoogleConfig();
  const cookieOptions = {
    httpOnly: true,
    secure: config?.secure ?? false,
    sameSite: "lax" as const,
    path: AUTH_PATH,
  };

  function startGoogleFlow(res: Response, intent: "login" | "signup"): string | null {
    if (!config) return null;

    const state = crypto.randomBytes(32).toString("base64url");
    const nonce = crypto.randomBytes(32).toString("base64url");
    const verifier = crypto.randomBytes(32).toString("base64url");
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    const termsAcceptedAt = intent === "signup" ? new Date().toISOString() : undefined;
    res.cookie(
      OAUTH_COOKIE,
      { state, nonce, verifier, intent, termsAcceptedAt, expiresAt: Date.now() + FLOW_DURATION_MS },
      { ...cookieOptions, signed: true, maxAge: FLOW_DURATION_MS }
    );
    return config.client.generateAuthUrl({
      scope: ["openid", "email", "profile"],
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: CodeChallengeMethod.S256,
      prompt: "select_account",
    });
  }

  app.get(AUTH_PATH, rateLimit("google-start", 10, "Too many Gmail sign-in attempts. Try again shortly."), (req, res) => {
    res.set("Cache-Control", "no-store");
    if (req.query.intent === "signup") {
      res.redirect("/signup?google=terms-required");
      return;
    }
    if (!config) {
      res.redirect("/login?google=unavailable");
      return;
    }

    const authorizationUrl = startGoogleFlow(res, "login");
    if (!authorizationUrl) {
      res.redirect("/login?google=unavailable");
      return;
    }
    res.redirect(authorizationUrl);
  });

  app.post(AUTH_PATH, rateLimit("google-start", 10, "Too many Gmail sign-in attempts. Try again shortly."), (req, res) => {
    res.set("Cache-Control", "no-store");
    const origin = req.get("origin");
    const host = req.get("host");
    if (!origin || !host || !["http", "https"].some((scheme) => origin === `${scheme}://${host}`)) {
      res.status(403).json({ error: "Invalid request origin." });
      return;
    }

    const intent = req.body?.intent === "signup" ? "signup" : "login";
    if (intent === "signup" && req.body?.acceptTerms !== true) {
      res.status(400).json({ error: "Agree to the Terms of Service before creating an account." });
      return;
    }
    if (!config) {
      res.status(503).json({ error: "Gmail sign-in is not set up yet." });
      return;
    }

    const authorizationUrl = startGoogleFlow(res, intent);
    if (!authorizationUrl) {
      res.status(503).json({ error: "Gmail sign-in is not available." });
      return;
    }
    res.json({ authorizationUrl });
  });

  app.get(CALLBACK_PATH, rateLimit("google-callback", 25, "Too many Gmail sign-in attempts. Try again shortly."), async (req, res) => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const flow = req.signedCookies[OAUTH_COOKIE];
    res.clearCookie(OAUTH_COOKIE, cookieOptions);

    if (!config || !flow || typeof flow.state !== "string" || flow.state !== req.query.state ||
        typeof flow.expiresAt !== "number" || Date.now() >= flow.expiresAt ||
        typeof flow.verifier !== "string" || typeof flow.nonce !== "string" ||
        (flow.intent !== "login" && flow.intent !== "signup") ||
        (flow.intent === "signup" && typeof flow.termsAcceptedAt !== "string")) {
      res.redirect("/login?google=expired");
      return;
    }
    if (req.query.error === "access_denied") {
      res.redirect("/login?google=cancelled");
      return;
    }
    if (typeof req.query.code !== "string" || !req.query.code) {
      res.redirect("/login?google=failed");
      return;
    }

    try {
      const { tokens } = await config.client.getToken({
        code: req.query.code,
        codeVerifier: flow.verifier,
      });
      if (!tokens.id_token) {
        res.redirect("/login?google=failed");
        return;
      }
      const ticket = await config.client.verifyIdToken({
        idToken: tokens.id_token,
        audience: config.clientId,
      });
      const identity = ticket.getPayload() as (TokenPayload & { nonce?: string }) | undefined;
      if (!identity?.sub || identity.nonce !== flow.nonce) {
        res.redirect("/login?google=failed");
        return;
      }

      const email = identity.email?.toLowerCase();
      if (!identity.email_verified || !email || !/@(?:gmail|googlemail)\.com$/.test(email)) {
        res.redirect("/login?google=gmail-required");
        return;
      }

      // Read and write without an await so concurrent callbacks cannot create duplicate users.
      const db = readDb();
      let user = db.users.find((record) => record.googleSubject === identity.sub);
      if (!user) {
        const existing = db.users.find((record) => record.email.toLowerCase() === email);
        if (existing) {
          if (existing.suspended) {
            res.redirect("/login?google=suspended");
            return;
          }
          if (existing.googleSubject) {
            res.redirect("/login?google=existing");
            return;
          }
          existing.googleSubject = identity.sub;
          writeDb(db);
          user = existing;
        } else {
          if (flow.intent !== "signup") {
            res.redirect("/login?google=signup-required");
            return;
          }
          const name = cleanPlainText(identity.name ?? "").slice(0, 60);
          user = {
            id: `user-${crypto.randomUUID()}`,
            name: name || email.split("@")[0],
            email,
            googleSubject: identity.sub,
            termsAcceptedAt: flow.termsAcceptedAt as string,
            termsVersion: TERMS_VERSION,
            createdAt: new Date().toISOString(),
          } satisfies UserRecord;
          db.users.push(user);
          writeDb(db);
        }
      }

      if (user.suspended) {
        res.redirect("/login?google=suspended");
        return;
      }
      if (bootstrapVerifiedAdmin(db, user, email, process.env.BOOTSTRAP_ADMIN_EMAIL)) {
        writeDb(db);
      }
      setSessionCookie(res, user.id, config.secure);
      res.redirect("/");
    } catch {
      res.redirect("/login?google=failed");
    }
  });
}

