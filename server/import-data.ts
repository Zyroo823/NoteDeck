import "dotenv/config";
import { readFileSync } from "node:fs";
import { closeStorage, initializeStorage, readDb, removeLegacyDemo, writeDb, type DatabaseState } from "./store";

const collections = ["users", "studySets", "cards", "studyGuides", "quizAttempts", "generationJobs"] as const;

async function importData() {
  const input = process.argv[2];
  if (!input || !process.env.DATABASE_URL?.trim()) throw new Error("Provide a JSON backup path and configure DATABASE_URL.");
  const data = JSON.parse(readFileSync(input, "utf8")) as DatabaseState;
  if (!data || collections.some((key) => !Array.isArray(data[key])) ||
      (data.folders !== undefined && !Array.isArray(data.folders)) ||
      (data.adminAudit !== undefined && !Array.isArray(data.adminAudit))) {
    throw new Error("Expected a NoteDeck database backup.");
  }
  removeLegacyDemo(data);
  await initializeStorage();
  const existing = await readDb();
  if (collections.some((key) => existing[key].length > 0) || existing.folders?.length || existing.adminAudit?.length) {
    throw new Error("The target already contains data. Import requires an empty NoteDeck store.");
  }
  await writeDb(data, existing);
  console.log("Imported the NoteDeck backup into PostgreSQL.");
}

try {
  await importData();
} catch (error) {
  console.error(error instanceof SyntaxError
    ? "The backup is not valid JSON."
    : "Import failed. Check the database schema and connection, backup format, and that the target store is empty.");
  process.exitCode = 1;
} finally {
  await closeStorage();
}
