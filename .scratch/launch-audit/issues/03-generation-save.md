# Validate completed generation before save

Status: ready-for-agent
Priority: P1

`POST /api/generate/:id/save` accepted fabricated content for a failed job and accepted a second save. Require a completed job and prevent repeated save. Define how user edits to the preview are permitted; preserve this editing feature. Add focused tests for failed, processing, completed, and duplicate submissions. See `docs/launch-audit-2026-11-16.md`.
