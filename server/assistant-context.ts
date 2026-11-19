import type { AssistantMaterial } from "../src/chatbot/assistant";
import { openStudyData } from "./study-data";
import type { DatabaseState, StudyGuideRecord } from "./store";

export const ASSISTANT_CONTEXT_CHARS = 12_000;

function takeLines(lines: Iterable<string>, limit: number): string {
  let output = "";
  for (const line of lines) {
    const space = limit - output.length;
    if (space <= 0) break;
    output += line.slice(0, space);
  }
  return output;
}

function* guideLines({ summary, important_terms, key_concepts }: StudyGuideRecord["content"]) {
  yield `Summary:\n${summary.slice(0, 4500)}\n`;
  yield "\nImportant terms:\n";
  yield takeLines(important_terms.map((term) => `- ${term}\n`), 2000);
  yield "\nKey concepts:\n";
  for (const { heading, bullets } of key_concepts) {
    yield `${heading}\n`;
    for (const bullet of bullets) yield `- ${bullet}\n`;
  }
}

export function buildAssistantContext(db: DatabaseState, userId: string, material: AssistantMaterial) {
  const { data } = openStudyData(userId, db);
  if (material.kind === "guide") {
    const guide = data.studyGuides.find(({ id }) => id === material.id);
    if (!guide) return null;
    const title = `Study guide: ${guide.title.slice(0, 160)}\n`;
    return title + takeLines(guideLines(guide.content), ASSISTANT_CONTEXT_CHARS - title.length);
  }

  const set = data.studySets.find(({ id }) => id === material.id);
  if (!set) return null;
  const title = `Flashcard set and its practice test material: ${set.title.slice(0, 160)}\n`;
  const cards = data.cards.filter(({ setId }) => setId === set.id).sort((a, b) => a.position - b.position);
  const notes = set.studySource?.text;
  const cardBudget = notes ? 4600 : ASSISTANT_CONTEXT_CHARS - title.length;
  const flashcards = takeLines(cards.map(({ term, definition }) => `- ${term}: ${definition}\n`), cardBudget);
  let context = title + flashcards;
  if (notes) {
    const label = "\nSaved notes excerpt:\n";
    context += label + notes.slice(0, ASSISTANT_CONTEXT_CHARS - context.length - label.length);
  }
  return context;
}
