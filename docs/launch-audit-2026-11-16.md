# NoteDeck prelaunch audit — 16 November 2026

## Verdict and scope

**Do not launch for real users yet.** The live Render service is a free web service, while `server/store.ts` stores accounts and study materials in `.data/db.json`. Render's free filesystem is erased on spin down, restart, and redeploy. Other blockers below include a broken live Gmail flow and an API that can save fabricated AI results.

This audit reviewed the repository and exercised a production build in a separate temporary data directory with test accounts. It did not change the live service or real user data. A single-process concurrency check is not a load test. A successful Gmail OAuth callback and a real Gemini generation were not testable without configured credentials. The legal pages are truthful drafts, not a legal compliance certification.

## Launch blockers

| Priority | Finding and evidence | Required action |
| --- | --- | --- |
| P0 | **Accounts and content can disappear.** The live Render service reports `plan: free`; `server/store.ts:89-90,381-401` writes `.data/db.json`. Render documents that free web service filesystem changes are lost on spin down, restart, or redeploy. This includes password hashes, sets, guides, jobs, and admin roles. | Move to durable data storage with backups and a migration of existing data before inviting users. Verify restore and restart behavior. |
| P1 | **Gmail sign-in is unavailable live.** `GET https://notedeck-94ft.onrender.com/api/auth/google` returned HTTP 302 to `/login?google=unavailable` during this audit. `server/google-auth.ts:13-19` requires client ID, secret, and a stable session secret. The login button still offers Gmail. | Configure the production OAuth client, callback URL, and stable secret, then complete a real end-to-end sign-in and account-linking test. |
| P1 | **Generation save accepts untrusted job results.** `server.ts:857-922` checks ownership and schema but does not require `job.status === "done"`, compare against a completed preview, or reject a second save. In the isolated test, a failed generation job accepted fabricated content with HTTP 201 twice, creating duplicate sets and guides. | Require a completed job, enforce one save per job, and define whether edited preview fields may be saved. Test failed, pending, completed, and repeated submissions. |
| P1 | **Mutation requests lack consistent origin protection.** Admin role updates check `Origin` at `server.ts:195-200`; most other cookie-authenticated POST/PATCH/DELETE routes do not. A folder PATCH with `Origin: https://evil.example` and a valid session cookie returned HTTP 200 in the isolated test. SameSite=Lax reduces many browser cross-site cases, so this test establishes a server-side gap rather than a proven exploit from any website. | Apply a shared origin/CSRF policy to state-changing routes, then test browser requests from a separate origin. |
| P1 | **Account recovery is incomplete.** Password reset, email verification, and a general retention schedule are not implemented. The operator name, Philippines base, and private privacy contact are now published. Settings includes account export and deletion from the active JSON store. | Implement account recovery and verification, set retention periods, and review privacy terms with the owner before launch. GitHub Issues remains public and must not be used for secrets or private account details. |
| P1 | **Audience and age policy are undecided.** The operator is based in the Philippines, but the countries served and minimum user age/parent process are not selected. | Decide the intended markets and audience, then review child privacy and age-assurance obligations for each target jurisdiction before accepting child accounts. |
| P1 | **Session lifecycle is incomplete.** `server/store.ts:110-141` signs a token containing `iat` but never checks its age. A copied token could remain valid after the browser's seven-day cookie expires. Password sign-in now sets `Secure` when `NODE_ENV=production`; the production environment setting has not been verified. Without `SESSION_SECRET`, restarts also invalidate all sessions. | Require a persistent secret, enforce token expiry and server-side invalidation, and confirm production cookie settings. Verify sign-in, logout, expiration, suspension, and restart. |

## Other findings and limits

| Priority | Finding |
| --- | --- |
| P2 | Rate limits in `server/rate-limit.ts` are per process and use the connection IP. They reset on restart and do not coordinate across replicas. This was inspected in code; behavior behind Render's proxy was not verified. |
| P2 | The initial auth request in `src/App.tsx:84-106` has no timeout, so a request that never resolves can leave the app on a spinner. `handleLogout` at `src/App.tsx:123-129` does not handle a failed network request. |
| P2 | `src/components/GenerateModal.tsx:46-74` stops polling after one network error, even if the server job continues. There is no resume flow after navigation or restart. Slow or interrupted networks need a retry/recovery test. |
| P2 | Quiz scores are posted from the browser to `/api/attempts`; the server validates ownership and numeric ranges but does not independently grade answers. Treat scores as self-reported if they will ever be used for trust decisions. |
| P2 | No production performance or multi-instance contention test has been run. The JSON store performs synchronous whole-file reads/writes and is unsuitable for scaled concurrent use. |

There is **no payment or checkout implementation** in this repository, so there was no payment flow to test. There is **no database-native RLS** because the app uses a local JSON file; `server/study-data.ts` scopes study rows to the authenticated user. If the app moves to Postgres/Supabase, create and verify database policies separately. A tracked-file scan found no obvious API key literals; `.env*` is ignored except `.env.example`. This does not prove secrets have never appeared in Git history, logs, or deployment settings.

The app currently has no paid plan, marketing-email subscription, public review/testimonial, advertising or analytics SDK, or stock photo displayed in its UI. No refund or unsubscribe flow applies to the current feature set. The five unreferenced PNG screenshots that were under `public/assets/aistudio/` have been moved to `docs/unpublished-assets/aistudio/` because their distribution rights were not recorded. The current design uses labeled controls and keyboard focus styles in many views, and a skip-to-content link was added, but a full WCAG contrast and keyboard audit has not been completed.

## Checks performed

| Area | Result |
| --- | --- |
| Password signup/login | Isolated API: valid signup 201, invalid signup 400, duplicate email 409, wrong password 401; mobile browser login succeeded. Two simultaneous signups with one email returned 201 and 409. |
| Authorization | Unauthenticated library request 401; account B reading account A's set, guide, and generation job returned 404; non-admin admin-list request returned 403; cross-account folder edit returned 404. These are sampled paths, not a proof for every future endpoint. |
| Forms and AI input | Invalid set and short generation input returned 400; file size/type and schema paths were reviewed. A real Gemini response and upload extraction across supported formats were not tested. |
| Folders/concurrency | Ten concurrent folder creates on one isolated process returned 201 and all appeared in the resulting list. This does not cover multiple instances or high traffic. |
| Study content CRUD | Isolated API: created and edited a set, added and edited a card, saved a test attempt, added and removed the set from a folder, deleted the folder and set, edited and deleted a guide, and updated a profile. Each expected success returned 200/201; deleted set and guide returned 404 on later reads. |
| Mobile study flow | In a 390px browser, the plus menu opened Folder, Practice test, Generate study materials, and Flashcard set. The set form showed an invalid-title error, then created a one-card set and navigated to its detail page; its Test tab displayed the question. Generate modal labels Google Drive and lecture recording as coming soon. |
| Mobile, slow requests, and errors | At 390, 768, and 1280px, the tested library view had no horizontal overflow; desktop sidebar began at x=0 with 240px width and main content began at x=240. An 1.8-second library delay left the page usable with loading placeholders before content appeared. Aborting a practice-test library request showed an error message. Other routes and device sizes were not exhaustively visual-tested. |
| Navigation | New Privacy and Terms pages returned 200 without authentication; unknown page returned a visible custom 404 with HTTP 404; unknown API path returned JSON 404 in the isolated production build. |
| Public links | Landing, login, and signup pages exposed only expected local links (`/`, auth routes, Privacy, Terms, and the existing `#study-tools` anchor). The anchor target exists. This is a sampled link check, not a full crawl of every authenticated state. |
| Build | `npm run lint`, `npm run build`, and seven existing `studyLogic` tests passed. Vite reported a nonblocking config warning about `__dirname`. |
| Dependency advisories | `npm audit --omit=dev --audit-level=high` could not reach the npm advisory endpoint in this environment, so dependency vulnerability status remains unverified. Run it in CI or a connected terminal before launch. |

## Changes in this audit

- Added public `/privacy` and `/terms` pages and navigation links from the landing page, auth screen, and app shell. The pages identify the operator and provide a private email for account/privacy requests; they warn users not to post secrets or personal notes in public GitHub Issues.
- Added a custom 404 page and production HTTP 404 handling for unknown page/API routes. Legal and unknown routes render without waiting for the auth request.
- Added `/cookies` with the current essential-cookie inventory; no non-essential cookie banner is shown because the app does not currently set advertising or analytics cookies.
- Required Terms acceptance for password signup and new Google signups, recording the accepted version and timestamp. Existing accounts are not forced to reaccept.
- Added account data export and self-service account deletion, plus Cookie Policy and skip-to-content links. Contrast improvements darken default muted text and solid primary buttons.
- Moved five unused screenshots out of `public/` until source/distribution rights are confirmed.

## Checklist from the supplied image

| # | Item | Status in NoteDeck |
| ---: | --- | --- |
| 1 | Privacy policy | Draft updated with current data, purposes, providers, and choices; the operator name and contact are provided. Supported markets, age policy, retention details, and legal review remain open. |
| 2 | Terms of service | Draft updated; new signup requires agreement and records the version/time. Legal review remains open. |
| 3 | Refund policy | No payment feature or fee exists. Terms state that no refunds apply to the free preview; add full refund/cancellation terms before charging. |
| 4 | Cookie policy | `/cookies` lists the session and OAuth cookies plus local theme storage. |
| 5 | Cookie consent banner | Not shown because the app currently sets only essential sign-in cookies and has no ad or analytics cookies. Reassess before adding tracking. |
| 6 | Form consents | Signup requires a Terms checkbox and privacy notice link. This records contract acknowledgment; it does not settle the lawful basis for every data use. |
| 7 | Collect only needed data | Signup asks for name, email, and password, or Google identity. It does not ask for age, phone, location, or payment information. A warning tells users not to enter personal data in AI generation. |
| 8 | Audit third-party SDKs | The current app sends chosen AI input to Google Gemini, uses Google for optional sign-in, and is hosted on Render. No advertising or analytics SDK is present in the app code. |
| 9 | Remove dark patterns | The current app has no paid upgrade, preselected marketing consent, fake urgency, or obstructive cookie choice flow. Revisit if monetization is added. |
| 10 | No hidden fees | The preview has no fees or checkout; this is disclosed in Terms. |
| 11 | No fake reviews | The app currently publishes no reviews or testimonials. |
| 12 | No unsupported claims | Current landing copy makes no quantified performance guarantee; AI accuracy limits are disclosed. Review copy when features change. |
| 13 | Alt text | The only rendered image is a decorative favicon next to the text logo and has empty alt text. No content images are used in the UI. |
| 14 | Color contrast | Muted default text and solid primary button colors were darkened. Full WCAG contrast measurement across routes/states remains open. |
| 15 | Keyboard navigation | A skip-to-content link was added and controls use native links/buttons/forms. Full keyboard and focus-order audit remains open. |
| 16 | Business details | Operator name (John Mar Aledon), Philippines base, and private contact email are now published. Confirm any additional business disclosures required for the chosen markets. |
| 17 | Age consent for kids | Not complete. Operator is based in the Philippines, but service markets and intended minimum age are undecided; see issue `07-audience-and-age-policy.md`. |
| 18 | Unsubscribe link | No marketing email subscription is implemented. Add an unsubscribe flow if marketing emails are introduced. |
| 19 | License stock images | No stock photo is shown in the UI. Five unused screenshots were moved out of `public/` pending source/license confirmation; see issue `08-asset-provenance.md`. |
| 20 | Data deletion option | Settings now provides JSON export and permanent deletion from NoteDeck’s active data file. This does not delete separate provider copies or establish an inactive-account retention period. |

These changes are local only. They are not a replacement for the launch blockers above.

## Sources

- Render free-service storage: https://render.com/docs/free
- Render persistent disks: https://render.com/docs/disks
- Philippine National Privacy Commission, Data Privacy Act implementing rules: https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/
