# Protect state-changing session routes

Status: ready-for-agent
Priority: P1

A folder update with a foreign `Origin` and valid cookie returned 200 in an isolated test. Apply a consistent CSRF/origin policy to authenticated mutations, preserving the OAuth callback and legitimate same-origin requests. Include a real-browser cross-origin test. See `docs/launch-audit-2026-11-16.md`.
