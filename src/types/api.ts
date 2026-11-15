import type { StudyGuideContent } from "@/src/lib/schemas";
import type { StudyCardItem } from "@/src/lib/studyLogic";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: "admin" | "user";
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

export interface QuizAttemptSummary {
  id: string;
  score: number;
  total: number;
  createdAt: string;
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

export interface StudyGuideDetail {
  id: string;
  setId: string | null;
  title: string;
  content: StudyGuideContent;
  createdAt: string;
  updatedAt: string;
}

