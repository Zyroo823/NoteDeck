import crypto from "node:crypto";
import type { StudyGroupDetail, StudyGroupSummary } from "../src/types/api";
import type { DatabaseState, StudyGroupRecord } from "./store";

export const MAX_GROUPS_PER_MEMBER = 25;
export const MAX_STUDY_GROUP_MEMBERS = 50;

export function studyGroupsForUser(db: DatabaseState, userId: string) {
  return (db.studyGroups ?? []).filter(({ memberIds }) => memberIds.includes(userId));
}

export function summarizeStudyGroup(group: StudyGroupRecord, userId: string): StudyGroupSummary {
  return { id: group.id, name: group.name, isOwner: group.ownerId === userId, memberCount: group.memberIds.length };
}

export function studyGroupDetail(db: DatabaseState, group: StudyGroupRecord, userId: string): StudyGroupDetail | null {
  if (!group.memberIds.includes(userId)) return null;
  const memberIds = new Set(group.memberIds);
  const members = db.users.filter(({ id }) => memberIds.has(id)).map(({ id, name }) => ({ id, name, isOwner: id === group.ownerId }));
  const summary = summarizeStudyGroup(group, userId);
  return { ...summary, members, ...(summary.isOwner ? { inviteCode: group.inviteCode } : {}) };
}

export function newStudyGroupInviteCode(db: DatabaseState): string {
  let code: string;
  do {
    code = crypto.randomBytes(8).toString("hex").toUpperCase();
  } while (db.studyGroups?.some((group) => group.inviteCode === code));
  return code;
}

export function removeUserFromStudyGroups(db: DatabaseState, userId: string): void {
  if (!db.studyGroups) return;
  db.studyGroups = db.studyGroups.filter(({ ownerId }) => ownerId !== userId);
  for (const group of db.studyGroups) {
    group.memberIds = group.memberIds.filter((id) => id !== userId);
  }
}
