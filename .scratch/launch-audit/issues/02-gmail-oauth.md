# Make advertised Gmail sign-in work

Status: needs-info
Priority: P1

The live `/api/auth/google` returned `/login?google=unavailable` on 2026-11-16. Configure the production Google OAuth client ID, secret, redirect URI, and stable session secret. Test new-account sign-in and verified-email linking without sharing credentials in tickets. See `docs/launch-audit-2026-11-16.md`.
