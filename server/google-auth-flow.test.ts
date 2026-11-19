import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import cookieParser from "cookie-parser";
import express from "express";
import { LoginTicket, OAuth2Client } from "google-auth-library";
import { TERMS_VERSION } from "../src/lib/legal";
import { requireSameOrigin, SESSION_COOKIE } from "./security";

test("Gmail sign-in and signup share the same account flow", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "notedeck-google-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const config = {
    NODE_ENV: "development",
    SESSION_SECRET: "notedeck-google-auth-test-session-secret",
    GOOGLE_OAUTH_CLIENT_ID: "test-client-id",
    GOOGLE_OAUTH_CLIENT_SECRET: "test-client-secret",
    GOOGLE_OAUTH_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
    BOOTSTRAP_ADMIN_EMAIL: "",
  };
  for (const [key, value] of Object.entries(config)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }

  // The JSON store resolves its data directory when first imported.
  const cwd = process.cwd();
  process.chdir(directory);
  const { createSessionToken, readDb, writeDb, verifySessionToken } = await import("./store")
    .finally(() => process.chdir(cwd));
  const { registerGoogleAuth } = await import("./google-auth");

  let authorizationUrl: URL;
  let subject = "google-subject";
  let email = "new-user@gmail.com";
  t.mock.method(OAuth2Client.prototype, "getToken", async ({ code, codeVerifier }: { code: string; codeVerifier: string }) => {
    assert.equal(code, "test-code");
    assert.equal(createHash("sha256").update(codeVerifier).digest("base64url"), authorizationUrl.searchParams.get("code_challenge"));
    return { tokens: { id_token: "test-id-token" } };
  });
  t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => {
    const nonce = authorizationUrl.searchParams.get("nonce");
    assert(nonce);
    const payload = {
      iss: "https://accounts.google.com",
      aud: config.GOOGLE_OAUTH_CLIENT_ID,
      sub: subject,
      email,
      email_verified: true,
      nonce,
      iat: 0,
      exp: 0,
    };
    return new LoginTicket(undefined, payload);
  });

  const app = express();
  app.use("/api", requireSameOrigin);
  app.use(cookieParser(config.SESSION_SECRET));
  app.use(express.json());
  registerGoogleAuth(app, (res, user) => res.cookie(SESSION_COOKIE, createSessionToken(user)));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const authUrl = `${origin}/api/auth/google`;

  async function start(intent: "login" | "signup") {
    const response = await fetch(authUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ intent }),
    });
    assert.equal(response.status, 200);
    const cookie = response.headers.get("set-cookie")?.split(";")[0];
    assert(cookie);
    const data = await response.json() as { authorizationUrl: string };
    authorizationUrl = new URL(data.authorizationUrl);
    assert.equal(authorizationUrl.searchParams.get("code_challenge_method"), "S256");
    const state = authorizationUrl.searchParams.get("state");
    assert(state);
    return () => fetch(`${authUrl}/callback?${new URLSearchParams({ state, code: "test-code" })}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
  }

  function assertSignedIn(response: Response, db: Awaited<ReturnType<typeof readDb>>, userId: string) {
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/");
    const cookie = response.headers.getSetCookie().find((value) => value.startsWith(`${SESSION_COOKIE}=`));
    const token = cookie?.split(";")[0]?.slice(SESSION_COOKIE.length + 1);
    assert.equal(verifySessionToken(token, db), userId);
  }

  await t.test("login intent creates an account and records consent at flow start", async () => {
    const beforeStart = Date.now();
    const callback = await start("login");
    const startCompleted = Date.now();
    const response = await callback();
    const db = await readDb();
    assert.equal(db.users.length, 1);
    const [user] = db.users;
    assert.equal(user.email, email);
    assert.equal(user.googleSubject, subject);
    assert(user.termsAcceptedAt);
    const acceptedAt = Date.parse(user.termsAcceptedAt);
    assert(acceptedAt >= beforeStart && acceptedAt <= startCompleted);
    assert.equal(user.termsVersion, TERMS_VERSION);
    assertSignedIn(response, db, user.id);
  });

  await t.test("a linked account signs in from either screen without changing consent", async () => {
    const original = await readDb();
    for (const intent of ["login", "signup"] as const) {
      const callback = await start(intent);
      const response = await callback();
      const db = await readDb();
      assert.deepEqual(db, original);
      assertSignedIn(response, db, original.users[0].id);
    }
  });

  await t.test("signup intent creates an account without a checkbox", async () => {
    subject = "another-google-subject";
    email = "another-user@gmail.com";
    const callback = await start("signup");
    const response = await callback();
    const db = await readDb();
    const user = db.users.find((record) => record.googleSubject === subject);
    assert(user?.termsAcceptedAt);
    assert.equal(user.termsVersion, TERMS_VERSION);
    assertSignedIn(response, db, user.id);
  });

  await t.test("a Gmail address linked to another Google identity is rejected", async () => {
    const original = await readDb();
    subject = "different-google-subject";
    const callback = await start("login");
    const response = await callback();
    assert.equal(response.headers.get("location"), "/login?google=existing");
    assert(!response.headers.getSetCookie().some((value) => value.startsWith(`${SESSION_COOKIE}=`)));
    assert.deepEqual(await readDb(), original);
  });

  await t.test("a suspended account cannot sign in", async () => {
    const db = await readDb();
    subject = db.users[0].googleSubject!;
    email = db.users[0].email;
    db.users[0].suspended = true;
    await writeDb(db);

    const callback = await start("login");
    const response = await callback();
    assert.equal(response.headers.get("location"), "/login?google=suspended");
    assert(!response.headers.getSetCookie().some((value) => value.startsWith(`${SESSION_COOKIE}=`)));
    assert.deepEqual(await readDb(), db);
  });

  await t.test("a direct GET sends the user to the consent notice without starting OAuth", async () => {
    const response = await fetch(`${authUrl}?intent=signup`, { redirect: "manual" });
    assert.equal(response.headers.get("location"), "/signup");
    assert.equal(response.headers.get("set-cookie"), null);
  });
});
