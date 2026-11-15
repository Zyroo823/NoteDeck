import test from "node:test";
import assert from "node:assert/strict";
import {
  buildQuizQuestions,
  gradeQuiz,
  shuffleCards,
  tokenizeSafeMarkdown,
  validateUploadFiles,
  type StudyCardItem,
} from "./studyLogic";
import { aiGenerationOutputSchema } from "./schemas";

const sampleCards: StudyCardItem[] = [
  { id: "1", term: "VLAN 1", definition: "Default native VLAN on Cisco switches", position: 0 },
  { id: "2", term: "Trunk Port", definition: "Carries traffic for multiple VLANs over one link", position: 1 },
  { id: "3", term: "Access Port", definition: "Assigns traffic to a single configured VLAN", position: 2 },
  { id: "4", term: "802.1Q", definition: "IEEE standard for VLAN frame tagging", position: 3 },
  { id: "5", term: "Router-on-a-Stick", definition: "Uses subinterfaces to route between VLANs", position: 4 },
];

test("buildQuizQuestions generates 4 unique options when set has >= 4 cards", () => {
  const questions = buildQuizQuestions(sampleCards);
  assert.equal(questions.length, 5);
  for (const q of questions) {
    assert.equal(q.options.length, 4);
    assert.ok(q.options.includes(q.correctAnswer));
    assert.equal(new Set(q.options).size, 4);
  }
});

test("buildQuizQuestions caps options to set size when fewer than 4 cards exist", () => {
  const twoCards = sampleCards.slice(0, 2);
  const questions = buildQuizQuestions(twoCards);
  assert.equal(questions.length, 2);
  for (const q of questions) {
    assert.equal(q.options.length, 2);
    assert.ok(q.options.includes(q.correctAnswer));
  }
});

test("gradeQuiz computes score and percentage accurately", () => {
  const questions = buildQuizQuestions(sampleCards);
  const selections: Record<string, string> = {
    "1": questions[0].correctAnswer,
    "2": questions[1].correctAnswer,
    "3": "Wrong answer",
    "4": questions[3].correctAnswer,
    "5": "Wrong answer",
  };
  const summary = gradeQuiz(questions, selections);
  assert.equal(summary.score, 3);
  assert.equal(summary.total, 5);
  assert.equal(summary.percentage, 60);
  assert.equal(summary.results[0].isCorrect, true);
  assert.equal(summary.results[2].isCorrect, false);
});

test("shuffleCards preserves all cards without mutating original array", () => {
  const originalIds = sampleCards.map((c) => c.id);
  const shuffled = shuffleCards(sampleCards);
  assert.equal(shuffled.length, sampleCards.length);
  assert.deepEqual(
    sampleCards.map((c) => c.id),
    originalIds
  );
  assert.deepEqual(
    shuffled.map((c) => c.id).sort(),
    [...originalIds].sort()
  );
});

test("validateUploadFiles enforces file count, size, extension, and MIME rules", () => {
  const ok = validateUploadFiles([
    { name: "notes.pdf", type: "application/pdf", size: 1024 },
    {
      name: "slides.pptx",
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      size: 2048,
    },
  ]);
  assert.equal(ok.valid, true);

  const tooMany = validateUploadFiles([
    { name: "a.pdf", type: "application/pdf", size: 100 },
    { name: "b.pdf", type: "application/pdf", size: 100 },
    { name: "c.pdf", type: "application/pdf", size: 100 },
  ]);
  assert.equal(tooMany.valid, false);

  const tooBig = validateUploadFiles([
    { name: "huge.pdf", type: "application/pdf", size: 26 * 1024 * 1024 },
  ]);
  assert.equal(tooBig.valid, false);

  const badExt = validateUploadFiles([
    { name: "malware.exe", type: "application/octet-stream", size: 512 },
  ]);
  assert.equal(badExt.valid, false);
});

test("tokenizeSafeMarkdown strips HTML/XSS tags and preserves bold and inline code", () => {
  const tokens = tokenizeSafeMarkdown(
    'Use **VLAN trunking** with `switchport mode trunk` <script>alert(1)</script> safely.'
  );
  const combined = tokens.map((t) => t.value).join("");
  assert.equal(combined.includes("<script>"), false);
  assert.ok(tokens.some((t) => t.kind === "bold" && t.value === "VLAN trunking"));
  assert.ok(tokens.some((t) => t.kind === "code" && t.value === "switchport mode trunk"));
});

test("aiGenerationOutputSchema validates strict AI JSON shape", () => {
  const valid = aiGenerationOutputSchema.safeParse({
    title: "Cell Biology Basics",
    cards: [{ term: "Mitochondria", definition: "Organelle that produces ATP." }],
    study_guide: {
      summary: "Cells convert nutrients into ATP.",
      key_concepts: [{ heading: "Energy", bullets: ["ATP powers cellular work."] }],
      important_terms: ["Mitochondria", "ATP"],
    },
  });
  assert.equal(valid.success, true);

  const invalid = aiGenerationOutputSchema.safeParse({
    title: "",
    cards: [],
  });
  assert.equal(invalid.success, false);
});
