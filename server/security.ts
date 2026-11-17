import crypto from "node:crypto";
import type { NextFunction, Request, RequestHandler, Response } from "express";

export const SESSION_COOKIE = "notedeck_session";
export const DELETION_COOKIE = "notedeck_delete_proof";
export const DELETION_PROOF_MS = 5 * 60 * 1000;

export function route<T extends Request>(handler: (req: T, res: Response, next: NextFunction) => unknown): RequestHandler {
  return (req, res, next) => {
    Promise.resolve().then(() => handler(req as T, res, next)).catch(next);
  };
}

export function setSecurityHeaders(_req: Request, res: Response, next: NextFunction): void {
  const production = process.env.NODE_ENV === "production";
  res.set({
    "Content-Security-Policy": [
      "default-src 'self'",
      production ? "script-src 'self'" : "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      production ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
  });
  if (production) res.set("Strict-Transport-Security", "max-age=31536000");
  next();
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }
  const origin = req.get("origin");
  const host = req.get("host");
  const production = process.env.NODE_ENV === "production";
  if (host && origin && req.get("sec-fetch-site") !== "cross-site" &&
      (origin === `https://${host}` || (!production && origin === `http://${host}`))) {
    next();
    return;
  }
  res.status(403).json({ error: "Invalid request origin." });
}

export function hashSession(token: string): string {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

export function hasDeletionProof(req: Request, userId: string): boolean {
  const proof = req.signedCookies?.[DELETION_COOKIE];
  const token = req.cookies?.[SESSION_COOKIE];
  return typeof token === "string" && proof?.userId === userId && proof?.sessionHash === hashSession(token) &&
    typeof proof.expiresAt === "number" && Date.now() < proof.expiresAt;
}
