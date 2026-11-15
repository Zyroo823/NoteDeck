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
- **Create an account** or try the app with its demo option.

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
