<div align="center">

# NoteDeck

**Turn your notes into a more focused study session.**

Create flashcards, explore study guides, and practice what you've learned—all in one place.

`React` · `TypeScript` · `Express` · `Gemini`

</div>

---

## What you can do

- **Make study sets** and edit your own flashcards.
- **Generate study materials** from pasted notes or PDF, DOCX, and PPTX files using Gemini.
- **Review with flashcards** and practice with multiple-choice quizzes.
- **Keep your materials together** in a personal library with study guides and quiz history.
- **Create an account** with a password or sign in with Gmail when configured.

## Getting started

### Prerequisites

- Node.js and npm
- A Gemini API key for AI generation

### Run locally

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and replace the placeholder with your Gemini API key:

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

3. Start the app:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

The server loads `.env` automatically. The API key is needed for generation; store it only in your local environment, never in source control.

### Enable Gmail sign-in

1. In [Google Cloud](https://console.cloud.google.com/), configure the OAuth consent screen and create a **Web application** OAuth client. If the app is in testing mode, add the Gmail accounts that will test it to the audience.
2. Add `http://localhost:3000/api/auth/google/callback` to the client's **Authorized redirect URIs**.
3. In `.env`, set `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, and `SESSION_SECRET`. Generate a session secret with `node -p "require('node:crypto').randomBytes(32).toString('hex')"`. Changing the session secret signs users out.
4. Restart the app and open it at `http://localhost:3000`. For another origin, set `GOOGLE_OAUTH_REDIRECT_URI` to the full callback URL and register that exact URI in Google Cloud. Use HTTPS for a non-loopback origin.

The first successful Gmail sign-in creates a NoteDeck account, or links the verified Gmail address to an existing account with the same email. Existing password sign-in remains available.

### Rate limits and account access

Signup, password login, and Gmail OAuth requests are limited per client IP. AI generation is limited per account before file parsing and still has the daily quota. These counters are in memory and apply within one server process. By default the app uses the connection IP and ignores forwarded IP headers.

NoteDeck's local JSON store enforces study record ownership in application code. Decks, cards, guides, attempts, and generation jobs are scoped to the signed-in account. The JSON store does not support database-native row-level security.

### Administrator access

Administrators can open **Manage users** from the profile menu to change roles and suspend or restore accounts. Suspending an account invalidates its existing sessions. Role and access changes are recorded in the local database. Administrators cannot change their own role or suspend their own account.

For a fresh database, set `BOOTSTRAP_ADMIN_EMAIL` to the owner's Gmail address. The first successful, verified Google sign-in for that exact address becomes administrator only if no active administrator exists. This setting does not grant administrator access through unverified password signup. Remove the bootstrap setting after the first administrator is established in durable storage.

## Project structure

```text
src/          React screens, components, and shared study logic
server/       AI generation, file extraction, and local data storage
server.ts     Express API and Vite integration
public/       Static assets
docs/agents/  Project guidance for installed agent skills
```

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts the local app and API |
| `npm run lint` | Runs the TypeScript check |
| `npm run build` | Builds the frontend for production |

## Data and configuration

NoteDeck stores account and study data locally in `.data/db.json`. This directory and `.env` files are ignored by Git. The app supports up to two uploaded files per generation request, with a limit of 25 MB per file. `DAILY_GENERATION_LIMIT` can be set in the environment; the default is five generations per user per day.

The current storage and session configuration is intended for local development. Review persistence, session secrets, and deployment security before hosting the app for others.

## Privacy and legal status

New account signup requires agreement to the current Terms of Service version. Settings includes a JSON data export and account deletion; deletion removes account-linked rows from the active app data file and does not request deletion from Google or hosting providers. The app uses essential sign-in cookies only, so it currently has no cookie consent banner; theme preference is stored in local storage.

The Privacy Policy and Terms are pre-launch drafts. The operator is John Mar Aledon, based in the Philippines, and the privacy contact is johnmaraledon823@gmail.com. Supported countries, age policy, and inactive-account retention still need owner decisions and legal review. The current app has no paid plans, checkout, marketing email subscriptions, public reviews, or third-party analytics. Do not treat these pages or code changes as a guarantee against legal claims.
