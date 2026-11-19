import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationInbox, markNotificationsRead } from "./notifications";
import type { DatabaseState, GenerationJobRecord, QuizAttemptRecord, StudySetRecord } from "./store";

const timestamp = "2026-11-20T00:00:00.000Z";
const set: StudySetRecord = { id: "set-one", userId: "owner", title: "Biology", sourceType: "ai", folderId: null, createdAt: timestamp, updatedAt: timestamp };
const quiz: QuizAttemptRecord = { id: "attempt-one", userId: set.userId, setId: set.id, attemptType: "set_test", score: 3, total: 4, createdAt: timestamp };
const job: GenerationJobRecord = { id: "job-one", userId: set.userId, status: "done", sourceKind: "text", stepMessage: "Saved", previewResult: null,
  resultSetId: set.id, resultGuideId: null, error: null, createdAt: timestamp, updatedAt: "2026-11-20T01:00:00.000Z" };

function fixture(): DatabaseState {
  return {
    users: [], folders: [], cards: [], studyGuides: [],
    studySets: [set, { ...set, id: "set-other", userId: "other", title: "Private set" }],
    quizAttempts: [{ ...quiz }, { ...quiz, id: "attempt-other", userId: "other", setId: "set-other" }],
    generationJobs: [
      { ...job },
      { ...job, id: "job-failed", status: "failed", resultSetId: null, updatedAt: "2026-11-20T02:00:00.000Z" },
      { ...job, id: "job-draft", resultSetId: null },
      { ...job, id: "job-deleted", resultSetId: "missing-set" },
      { ...job, id: "job-other", userId: "other", resultSetId: "set-other" },
    ],
  };
}

test("the inbox shows only actionable recent activity owned by the account", () => {
  const inbox = getNotificationInbox(fixture(), "owner");
  assert.deepEqual(inbox.notifications.map(({ kind }) => kind), ["generation-failed", "generation-saved", "quiz"]);
  assert.equal(inbox.notifications[1].setId, set.id);
  assert.equal(inbox.notifications[2].description, "Biology · 3 of 4 correct");
  assert.equal(inbox.unreadCount, 3);
});

test("marking the selected alerts read never changes another account or a newer alert", () => {
  const db = fixture();
  const ids = getNotificationInbox(db, "owner").notifications.map(({ id }) => id);
  db.quizAttempts.push({ ...quiz, id: "attempt-new", createdAt: "2026-11-20T03:00:00.000Z" });
  assert(markNotificationsRead(db, "owner", [...ids, "quiz:attempt-other"]));
  assert.equal(getNotificationInbox(db, "other").unreadCount, 2);
  const inbox = getNotificationInbox(db, "owner");
  assert.equal(inbox.unreadCount, 1);
  assert.equal(inbox.notifications.find(({ id }) => id === "quiz:attempt-new")?.read, false);
  assert.equal(markNotificationsRead(db, "owner", ids), false);
});
