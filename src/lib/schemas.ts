import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
  acceptTerms: z.literal(true, "You must agree to the Terms of Service to create an account."),
});

export const accountDeletionSchema = z.object({
  email: z.string().trim().email("Enter your account email to confirm deletion."),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60, "Name is too long"),
});

export const cardInputSchema = z.object({
  term: z.string().trim().min(1, "Term is required").max(300, "Term is too long"),
  definition: z.string().trim().min(1, "Definition is required").max(2000, "Definition is too long"),
});

export const studySetInputSchema = z.object({
  title: z.string().trim().min(1, "Set title is required").max(160, "Set title is too long"),
  cards: z.array(cardInputSchema).min(1, "Add at least one flashcard").max(200, "Maximum 200 cards per set"),
});

export const folderNameSchema = z.string().trim().min(1, "Enter a folder name.").max(80, "Use 80 characters or fewer.");

export const folderItemInputSchema = z.object({
  kind: z.enum(["set", "guide"]),
  id: z.string().min(1),
  add: z.boolean(),
});

export const studyGuideConceptSchema = z.object({
  heading: z.string().trim().min(1, "Heading is required").max(160, "Heading is too long"),
  bullets: z.array(z.string().trim().min(1).max(600)).min(1, "Add at least one bullet point"),
});

export const studyGuideContentSchema = z.object({
  summary: z.string().trim().min(1, "Summary is required").max(5000, "Summary is too long"),
  key_concepts: z.array(studyGuideConceptSchema).min(1, "Add at least one key concept"),
  important_terms: z.array(z.string().trim().min(1).max(200)).max(80),
});

export const updateGuideSchema = z.object({
  title: z.string().trim().min(1, "Guide title is required").max(160, "Title is too long"),
  content: studyGuideContentSchema,
});

export const aiGenerationOutputSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  cards: z.array(cardInputSchema).min(1, "At least one card is required").max(50),
  study_guide: studyGuideContentSchema,
});

export const quizAttemptInputSchema = z.object({
  setId: z.string().min(1),
  score: z.number().int().min(0),
  total: z.number().int().min(1),
});

export const MAX_CHAT_QUESTION_CHARS = 1000;

export const studyChatInputSchema = z.object({
  requestId: z.uuid(),
  question: z.string().trim().min(1, "Enter a question.").max(MAX_CHAT_QUESTION_CHARS, "Use 1,000 characters or fewer."),
});

export const pastedTextSchema = z.object({
  text: z
    .string()
    .trim()
    .min(30, "Paste at least 30 characters of notes so AI has enough material")
    .max(50000, "Pasted text exceeds the 50,000 character limit"),
});

export const saveGeneratedResultSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(160),
  cards: z.array(cardInputSchema).min(1, "Keep at least one flashcard").max(50),
  study_guide: studyGuideContentSchema,
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type CardInput = z.infer<typeof cardInputSchema>;
export type StudySetInput = z.infer<typeof studySetInputSchema>;
export type StudyGuideConcept = z.infer<typeof studyGuideConceptSchema>;
export type StudyGuideContent = z.infer<typeof studyGuideContentSchema>;
export type UpdateGuideInput = z.infer<typeof updateGuideSchema>;
export type AiGenerationOutput = z.infer<typeof aiGenerationOutputSchema>;
export type QuizAttemptInput = z.infer<typeof quizAttemptInputSchema>;
export type SaveGeneratedResultInput = z.infer<typeof saveGeneratedResultSchema>;
