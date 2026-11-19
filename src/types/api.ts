import type { StudyGuideContent } from "@/src/lib/schemas";
import type { StudyCardItem } from "@/src/lib/studyLogic";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "user";
  hasPassword?: boolean;
  hasGoogle?: boolean;
}

export interface JumpBackInItem {
  id: string;
  title: string;
  cardCount: number;
  lastScorePct: number | null;
  updatedAt: string;
}

export interface RecentActivityItem {
  kind: "set" | "guide";
  id: string;
  title: string;
  cardCount: number;
  updatedAt: string;
}

export interface LibrarySetSummary {
  id: string;
  folderId: string | null;
  title: string;
  sourceType: "manual" | "ai" | "audio";
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LibraryGuideSummary {
  id: string;
  folderId: string | null;
  setId: string | null;
  title: string;
  conceptCount: number;
  termCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FolderSummary {
  id: string;
  name: string;
}

export interface StudyGroupSummary {
  id: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
}

export interface StudyGroupDetail extends StudyGroupSummary {
  inviteCode?: string;
  members: { id: string; name: string; isOwner: boolean }[];
}

export interface QuizAttemptSummary {
  id: string;
  score: number;
  total: number;
  createdAt: string;
}

export interface StudyNotification {
  id: string;
  kind: "quiz" | "generation-saved" | "generation-failed";
  title: string;
  description: string;
  createdAt: string;
  read: boolean;
  setId?: string;
}

export interface NotificationInbox {
  notifications: StudyNotification[];
  unreadCount: number;
}

export interface StudySetDetail {
  set: {
    id: string;
    title: string;
    sourceType: "manual" | "ai" | "audio";
    createdAt: string;
    updatedAt: string;
  };
  creatorName: string;
  cards: StudyCardItem[];
  linkedGuideId: string | null;
  attempts: QuizAttemptSummary[];
}

export interface StudyChatTurn {
  id: string;
  question: string;
  answer: string;
  createdAt: string;
}

export interface StudyChatDetail {
  turns: StudyChatTurn[];
  source: "notes" | "cards";
  sourceTruncated: boolean;
}

export interface StudyGuideDetail {
  id: string;
  setId: string | null;
  title: string;
  content: StudyGuideContent;
  createdAt: string;
  updatedAt: string;
}
