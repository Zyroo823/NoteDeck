# Durable account and study storage

Status: ready-for-human
Priority: P0

The live free Render web service stores all accounts and study content in `.data/db.json`. Free service filesystem changes are lost on spin down, restart, or redeploy. Select durable storage with backups, migrate existing data, and verify restore and restart behavior before public use. See `docs/launch-audit-2026-11-16.md`.
