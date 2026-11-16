# Enforce session expiry and HTTPS cookie settings

Status: ready-for-agent
Priority: P1

Signed session tokens contain `iat` but the verifier does not check age. Password login/signup set cookies without the `Secure` flag, and an unset `SESSION_SECRET` changes on every restart. Use a stable secret, enforce expiry/invalidation, and test logout, suspension, expiration, and restart. See `docs/launch-audit-2026-11-16.md`.
