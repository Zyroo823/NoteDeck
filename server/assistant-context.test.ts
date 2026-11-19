import assert from "node:assert/strict";
import test from "node:test";
import { assistantRequestSchema, materialFromPath } from "../src/chatbot/assistant";
import { ASSISTANT_CONTEXT_CHARS, buildAssistantContext } from "./assistant-context";
import type { DatabaseState } from "./store";

const now = "2026-11-20T00:00:00.000Z";
const set = { id: "set-one", userId: "owner", folderId: null, title: "Biology", sourceType: "ai" as const, createdAt: now, updatedAt: now };
const guide = { id: "guide-one", userId: "owner", setId: set.id, title: "Biology guide", createdAt: now, updatedAt: now,
  content: { summary: "Cells are the basic units of life.", important_terms: ["Cell"], key_concepts: [{ heading: "Structure", bullets: ["Membranes separate cells from their surroundings."] }] },
};
const db: DatabaseState = {
  users: [], generationJobs: [], quizAttempts: [],
  studySets: [
    { ...set, studySource: { text: `Class notes: chlorophyll absorbs light.\n${"sample notes ".repeat(2000)}`, truncated: false } },
    { ...set, id: "set-other", userId: "other", title: "Private set" },
    { ...set, id: "set-manual", sourceType: "manual", title: "Manual set" },
  ],
  cards: [
    { id: "card-one", setId: set.id, term: "Chlorophyll", definition: "Light-absorbing pigment", position: 0, isStarred: false, masteryStatus: "new" },
    { id: "card-two", setId: "set-other", term: "Other owner’s term", definition: "Private definition", position: 0, isStarred: false, masteryStatus: "new" },
    { id: "card-three", setId: "set-manual", term: "Atom", definition: "Unit of an element", position: 0, isStarred: false, masteryStatus: "new" },
  ],
  studyGuides: [guide, { ...guide, id: "guide-other", userId: "other", title: "Private guide" }],
};

test("open set context includes its cards and an excerpt of saved notes within the cap", () => {
  const context = buildAssistantContext(db, "owner", { kind: "set", id: set.id });
  assert(context);
  assert.equal(context.length, ASSISTANT_CONTEXT_CHARS);
  assert.match(context, /Chlorophyll: Light-absorbing pigment/);
  assert.match(context, /Class notes: chlorophyll absorbs light/);
  assert.doesNotMatch(context, /Private definition|Private set/);
});

test("guide summaries and manual flashcards can each ground an answer", () => {
  const guideContext = buildAssistantContext(db, "owner", { kind: "guide", id: guide.id });
  assert.match(guideContext ?? "", /Cells are the basic units of life/);
  assert.match(guideContext ?? "", /Important terms:\n- Cell/);
  const manualContext = buildAssistantContext(db, "owner", { kind: "set", id: "set-manual" });
  assert.match(manualContext ?? "", /Atom: Unit of an element/);
  assert.doesNotMatch(manualContext ?? "", /Chlorophyll|Saved notes/);
});

test("the assistant cannot resolve a foreign or missing set or guide", () => {
  for (const [kind, id] of [["set", "set-other"], ["guide", "guide-other"], ["set", "missing"]] as const) {
    assert.equal(buildAssistantContext(db, "owner", { kind, id }), null);
  }
});

test("only view routes provide context and request input is bounded", () => {
  assert.deepEqual(materialFromPath("/sets/set-one"), { kind: "set", id: "set-one" });
  assert.deepEqual(materialFromPath("/guides/a%20b"), { kind: "guide", id: "a b" });
  for (const path of ["/sets/new", "/sets/set-one/edit", "/library", "/practice-test", "/guides/%xx"]) {
    assert.equal(materialFromPath(path), undefined);
  }
  const request = { question: "Explain this", material: { kind: "set", id: set.id }, history: [] };
  assert(assistantRequestSchema.safeParse(request).success);
  assert(!assistantRequestSchema.safeParse({ ...request, question: "x".repeat(1001) }).success);
  assert(!assistantRequestSchema.safeParse({ ...request, history: Array(5).fill({ question: "Why?", answer: "Because." }) }).success);
  assert(!assistantRequestSchema.safeParse({ ...request, material: { ...request.material, text: "Client-supplied study context" } }).success);
});
