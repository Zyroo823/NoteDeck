import type { Request, RequestHandler } from "express";

const buckets = new Map<string, { hits: number; resetAt: number }>();
const maxBuckets = 20_000;
let nextSweep = 0;

export function rateLimit(
  bucket: string,
  max: number,
  message: string,
  identify: (req: Request) => string = (req) => req.ip ?? "unknown",
): RequestHandler {
  return (req, res, next) => {
    const now = Date.now();
    if (now >= nextSweep) {
      for (const [key, value] of buckets) {
        if (value.resetAt <= now) buckets.delete(key);
      }
      nextSweep = now + 60_000;
    }
    const key = `${bucket}:${identify(req)}`;
    const previous = buckets.get(key);
    if (previous && previous.resetAt > now && previous.hits >= max) {
      res.set("Retry-After", String(Math.ceil((previous.resetAt - now) / 1000)));
      res.status(429).json({ error: message });
      return;
    }
    if (!previous && buckets.size >= maxBuckets) {
      res.set("Retry-After", "60").status(429).json({ error: message });
      return;
    }
    if (!previous || previous.resetAt <= now) buckets.set(key, { hits: 1, resetAt: now + 60_000 });
    else previous.hits += 1;
    next();
  };
}
