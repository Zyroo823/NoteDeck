import assert from "node:assert/strict";
import test from "node:test";
import { studyGroupInviteSchema } from "../src/lib/schemas";
import { newStudyGroupInviteCode, removeUserFromStudyGroups, studyGroupDetail, studyGroupsForUser, summarizeStudyGroup } from "./study-groups";
import type { DatabaseState, StudyGroupRecord } from "./store";

function fixture() {
  const createdAt = "2026-11-20T00:00:00.000Z";
  const group: StudyGroupRecord = {
    id: "group-1", name: "Biology", ownerId: "owner", memberIds: ["owner", "friend"], inviteCode: "AB12CD34EF56AB78", createdAt,
  };
  const db: DatabaseState = {
    users: ["owner", "friend", "outsider"].map((id) => ({ id, name: id, email: `${id}@example.test`, createdAt })),
    studyGroups: [group], studySets: [], studyGuides: [], quizAttempts: [], generationJobs: [], cards: [],
  };
  return { db, group };
}

test("only group members see the roster, and only the owner sees the code", () => {
  const { db, group } = fixture();
  assert.equal(studyGroupDetail(db, group, "outsider"), null);
  assert.deepEqual(studyGroupsForUser(db, "outsider"), []);
  assert.equal(studyGroupDetail(db, group, "owner")?.inviteCode, group.inviteCode);
  assert(!("inviteCode" in summarizeStudyGroup(group, "owner")));
  const detail = studyGroupDetail(db, group, "friend");
  assert(detail);
  assert(!("inviteCode" in detail));
  assert.deepEqual(detail.members, [{ id: "owner", name: "owner", isOwner: true }, { id: "friend", name: "friend", isOwner: false }]);
});

test("invite codes accept the formatted copy and new codes differ from existing ones", () => {
  const { db, group } = fixture();
  assert.equal(studyGroupInviteSchema.parse({ code: " ab12-cd34-ef56-ab78 " }).code, group.inviteCode);
  assert.equal(studyGroupInviteSchema.safeParse({ code: "AB12-123" }).success, false);
  const code = newStudyGroupInviteCode(db);
  assert.match(code, /^[0-9A-F]{16}$/);
  assert.notEqual(code, group.inviteCode);
});

test("account deletion removes memberships and owner groups", () => {
  const { db, group } = fixture();
  const otherGroup = { ...group, id: "group-other", ownerId: "friend", memberIds: ["friend", "owner"], inviteCode: "1234567890ABCDFF" };
  db.studyGroups?.push(otherGroup);
  removeUserFromStudyGroups(db, "owner");
  assert.deepEqual(db.studyGroups, [{ ...otherGroup, memberIds: ["friend"] }]);
});
