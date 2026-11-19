import { NOTIFICATION_INBOX_LIMIT } from "../src/lib/schemas";
import type { NotificationInbox, StudyNotification } from "../src/types/api";
import type { DatabaseState, GenerationJobRecord, QuizAttemptRecord } from "./store";

function recentNotifications(db: DatabaseState, userId: string) {
  const sets = new Map(db.studySets.filter((set) => set.userId === userId).map((set) => [set.id, set]));
  const entries: { notification: StudyNotification; source: QuizAttemptRecord | GenerationJobRecord }[] = [];

  for (const attempt of db.quizAttempts) {
    if (attempt.userId !== userId) continue;
    const set = sets.get(attempt.setId);
    if (!set) continue;
    entries.push({ source: attempt, notification: {
      id: `quiz:${attempt.id}`,
      kind: "quiz",
      title: "Quiz completed",
      description: `${set.title} · ${attempt.score} of ${attempt.total} correct`,
      read: attempt.notificationRead === true,
      createdAt: attempt.createdAt,
      setId: set.id,
    } });
  }

  for (const job of db.generationJobs) {
    if (job.userId !== userId) continue;
    const set = job.resultSetId ? sets.get(job.resultSetId) : undefined;
    if (job.status === "done" && set) {
      entries.push({ source: job, notification: {
        id: `generation:${job.id}`,
        kind: "generation-saved",
        title: "AI study set saved",
        description: set.title,
        read: job.notificationRead === true,
        createdAt: job.updatedAt,
        setId: set.id,
      } });
    } else if (job.status === "failed") {
      entries.push({ source: job, notification: {
        id: `generation:${job.id}`,
        kind: "generation-failed",
        title: "AI generation failed",
        description: "Start a new generation to try again.",
        read: job.notificationRead === true,
        createdAt: job.updatedAt,
      } });
    }
  }

  return entries.sort((a, b) => Date.parse(b.notification.createdAt) - Date.parse(a.notification.createdAt))
    .slice(0, NOTIFICATION_INBOX_LIMIT);
}

export function getNotificationInbox(db: DatabaseState, userId: string): NotificationInbox {
  const notifications = recentNotifications(db, userId).map(({ notification }) => notification);
  return { notifications, unreadCount: notifications.filter(({ read }) => !read).length };
}

export function markNotificationsRead(db: DatabaseState, userId: string, ids: string[]): boolean {
  const selected = new Set(ids);
  let changed = false;
  for (const { notification, source } of recentNotifications(db, userId)) {
    if (!notification.read && selected.has(notification.id)) {
      source.notificationRead = true;
      changed = true;
    }
  }
  return changed;
}
