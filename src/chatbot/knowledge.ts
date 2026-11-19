// Keep these facts aligned with the landing page FAQ, README and shipped features.
export const assistantFaq = [
  {
    question: "What is NoteDeck?",
    topic: /what is notedeck|what (?:can|does) notedeck|how does notedeck work/i,
    answer: "NoteDeck helps you turn class notes into flashcards, study guides, and practice quizzes. You can try samples on the home page. Sign in to create, organize, and save your own materials.",
  },
  {
    question: "How do I generate flashcards?",
    topic: /generat|(?:make|create|add).*(?:flashcards|set)/i,
    answer: "Sign in and select **Generate study materials**. Paste notes or upload a PDF or PowerPoint, then review and edit the draft flashcards and guide summary before saving. To build your own cards, choose **Create a flashcard set** and enter terms and definitions.",
  },
  {
    question: "What can I upload?",
    topic: /upload|file type|file limit|pdf|pptx|powerpoint|word document/i,
    answer: "Upload up to two PDF or PowerPoint (.pptx) files per request, with up to 25 MB and 80 pages or slides per file. For Word documents, paste the text or export to PDF. Pasted text must be 30 to 50,000 characters. The default generation limit is five per account per day, and the operator can change it.",
  },
  {
    question: "How do I take a practice quiz?",
    topic: /practice|quiz|test mode/i,
    answer: "Open a set and choose **Test**, or use **Practice test** and select a flashcard set. The questions use the terms and definitions in that set. Completed attempts appear in your study history.",
  },
  {
    question: "Where are my saved materials?",
    topic: /librar|folder|saved material|study guide|summary|summaries/i,
    answer: "Open **Library** to find your saved flashcard sets and study guides. A guide contains a summary, key concepts, and important terms. Use folders to organize related sets and guides.",
  },
  {
    question: "How do accounts and billing work?",
    topic: /account|password|bill|pricing|paid|payment|subscri|gmail|sign in|sign up/i,
    answer: "You can create an account with email and password or use **Continue with Gmail** when it is configured. NoteDeck is a project preview and currently has no paid plans or checkout. Settings lets you export or delete your account data.",
  },
  {
    question: "What is the difference between Ask AI and NoteDeck Assistant?",
    topic: /ask ai.*(?:assistant|difference|vs)|(?:assistant|difference|vs).*ask ai/i,
    answer: "**Ask AI** is the chat tab inside a flashcard set. It answers from that set's saved notes or cards, and its conversation is saved with the set. **NoteDeck Assistant** is available throughout the app. It answers NoteDeck questions and can also help with the set or guide you have open. Its conversation stays in the current page session.",
  },
  {
    question: "How do study groups work?",
    topic: /study group|invite code|join.*group/i,
    answer: "Open **Study groups** from the sidebar. Create a group and share its invite code privately, or use **Join with a code** to join a friend's group. Members see the group name and other members' display names. Personal study materials stay in each member's library.",
  },
  {
    question: "What do the AI chat features use?",
    topic: /privacy|ask ai|assistant|my notes|data/i,
    answer: "The assistant can answer from the saved set or study guide you have open. Its conversation stays in the current page session. If you send a question while signed in, NoteDeck sends it, limited recent chat turns, and relevant material to Google Gemini. The separate **Ask AI** tab keeps its chat with the set.",
  },
] as const;

export const assistantKnowledge = `NoteDeck product knowledge and FAQ:
${assistantFaq.map(({ question, answer }) => `Q: ${question}\nA: ${answer}`).join("\n\n")}

TODO (owner): confirm supported countries, age policy, inactive-account retention, and public launch details. These are undecided. If asked, say you do not know.`;

export function answerGuestFaq(question: string): string {
  return assistantFaq.find((entry) => entry.question.toLowerCase() === question.toLowerCase())?.answer
    ?? assistantFaq.find((entry) => entry.topic.test(question))?.answer
    ?? "I don't have an answer for that in the public FAQ. Try one of the suggested questions or sign in to ask about your study materials.";
}
