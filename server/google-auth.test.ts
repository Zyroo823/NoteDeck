import assert from "node:assert/strict";
import test from "node:test";
import { bootstrapVerifiedAdmin } from "./google-auth";
import type { DatabaseState, UserRecord } from "./store";

function fixture(): { db: DatabaseState; user: UserRecord } {
  const user: UserRecord = {
    id: "owner",
    name: "Owner",
    email: "johnmaraledon823@gmail.com",
    googleSubject: "verified-google-subject",
    createdAt: "2026-11-16T00:00:00Z",
  };
  return {
    user,
    db: { users: [user], studySets: [], cards: [], studyGuides: [], quizAttempts: [], generationJobs: [] },
  };
}

test("bootstraps the configured verified Gmail account when no active admin exists", () => {
  const { db, user } = fixture();
  assert.equal(bootstrapVerifiedAdmin(db, user, user.email, " JOHNmaraledon823@gmail.com "), true);
  assert.equal(user.role, "admin");
});

test("does not grant admin to a mismatched, unlinked, or suspended account", () => {
  const wrong = fixture();
  assert.equal(bootstrapVerifiedAdmin(wrong.db, wrong.user, "attacker@gmail.com", wrong.user.email), false);
  assert.equal(wrong.user.role, undefined);

  const unlinked = fixture();
  delete unlinked.user.googleSubject;
  assert.equal(bootstrapVerifiedAdmin(unlinked.db, unlinked.user, unlinked.user.email, unlinked.user.email), false);

  const suspended = fixture();
  suspended.user.suspended = true;
  assert.equal(bootstrapVerifiedAdmin(suspended.db, suspended.user, suspended.user.email, suspended.user.email), false);
});

test("does not override an existing active administrator", () => {
  const { db, user } = fixture();
  db.users.push({ id: "other-admin", name: "Other", email: "other@gmail.com", role: "admin", createdAt: user.createdAt });
  assert.equal(bootstrapVerifiedAdmin(db, user, user.email, user.email), false);
  assert.equal(user.role, undefined);
});
