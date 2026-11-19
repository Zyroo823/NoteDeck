import { z } from "zod";

export const MAX_ASSISTANT_QUESTION = 1000;
export const MAX_ASSISTANT_ANSWER = 3600;
export const ASSISTANT_HISTORY_TURNS = 4;

const materialSchema = z.object({
  kind: z.enum(["set", "guide"]),
  id: z.string().min(1).max(200),
}).strict();

export const assistantRequestSchema = z.object({
  question: z.string().trim().min(1).max(MAX_ASSISTANT_QUESTION),
  material: materialSchema.optional(),
  history: z.array(z.object({
    question: z.string().trim().min(1).max(MAX_ASSISTANT_QUESTION),
    answer: z.string().trim().min(1).max(MAX_ASSISTANT_ANSWER),
  }).strict()).max(ASSISTANT_HISTORY_TURNS),
}).strict();

export type AssistantRequest = z.infer<typeof assistantRequestSchema>;
export type AssistantMaterial = z.infer<typeof materialSchema>;
export type AssistantTurn = AssistantRequest["history"][number];

export function materialFromPath(pathname: string): AssistantMaterial | undefined {
  const match = /^\/(sets|guides)\/([^/]+)\/?$/.exec(pathname);
  if (!match || pathname === "/sets/new" || pathname === "/sets/new/") return;
  try {
    const result = materialSchema.safeParse({ kind: match[1] === "sets" ? "set" : "guide", id: decodeURIComponent(match[2]) });
    if (result.success && !result.data.id.includes("/")) return result.data;
  } catch {
    // A malformed URL is not a material selection.
  }
}
