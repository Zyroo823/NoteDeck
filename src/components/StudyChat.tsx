import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { StudyChatMarkdown } from "@/src/components/StudyChatMarkdown";
import { MAX_CHAT_QUESTION_CHARS } from "@/src/lib/schemas";
import type { StudyChatDetail, StudyChatTurn } from "@/src/types/api";

const suggestedQuestions = [
  "What are the main ideas?",
  "Which terms should I review first?",
  "What are two questions I can use to check my understanding?",
];

interface QuestionRequest {
  requestId: string;
  question: string;
}

export function StudyChat({ setId, title }: { setId: string; title: string }) {
  const url = `/api/sets/${encodeURIComponent(setId)}/chat`;
  const [chat, setChat] = useState<StudyChatDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [failedRequest, setFailedRequest] = useState<QuestionRequest | null>(null);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const busy = Boolean(pendingQuestion) || clearing;

  const loadChat = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const response = await fetch(url, { signal });
      const data = (await response.json()) as StudyChatDetail & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load the chat.");
      if (!signal?.aborted) setChat(data);
    } catch (err) {
      if (!signal?.aborted) {
        setError(err instanceof Error ? err.message : "Could not load the chat.");
      }
    }
  }, [url]);

  useEffect(() => {
    const controller = new AbortController();
    void loadChat(controller.signal);
    return () => controller.abort();
  }, [loadChat]);

  useEffect(() => {
    const messages = messagesRef.current;
    if (messages) messages.scrollTop = messages.scrollHeight;
  }, [chat?.turns, pendingQuestion, failedRequest]);

  async function sendQuestion(request: QuestionRequest) {
    if (!chat || busy) return;
    setDraft("");
    setError("");
    setFailedRequest(null);
    setPendingQuestion(request.question);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as { turns: StudyChatTurn[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not send the question.");
      setChat({ ...chat, turns: data.turns });
    } catch (err) {
      setFailedRequest(request);
      setError(err instanceof Error ? err.message : "Could not send the question.");
    } finally {
      setPendingQuestion("");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = draft.trim();
    if (question) void sendQuestion({ requestId: crypto.randomUUID(), question });
  }

  async function clearChat() {
    if (!chat || busy) return;
    setClearing(true);
    setError("");
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Could not clear the chat.");
      }
      setChat({ ...chat, turns: [] });
      setFailedRequest(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear the chat.");
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  }

  return (
    <section aria-label="Ask AI" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]">
      {chat ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {chat.source === "cards"
                ? "No source notes are saved. Answers use the flashcards in this set."
                : chat.sourceTruncated
                  ? "Answers use the saved portion of your notes. The source exceeded the storage limit."
                  : "Answers use the source notes saved with this set."}
            </p>
            <button
              type="button"
              disabled={busy || (!chat.turns.length && !failedRequest)}
              onClick={() => setConfirmClear(true)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-[#1C2336]"
            >
              Clear chat
            </button>
          </div>

          {chat.turns.length || pendingQuestion || failedRequest ? (
            <div
              ref={messagesRef}
              role="log"
              aria-label="Chat messages"
              className="max-h-96 space-y-3 overflow-y-auto rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              {chat.turns.map((turn) => (
                <div key={turn.id} className="space-y-3">
                  <p className="ml-auto w-fit max-w-full rounded-xl bg-indigo-50 px-3 py-2 whitespace-pre-wrap wrap-break-word dark:bg-indigo-950/60">
                    <span className="sr-only">You: </span>{turn.question}
                  </p>
                  <div className="max-w-full rounded-xl bg-slate-100 px-3 py-2 wrap-break-word dark:bg-[#1C2336]">
                    <span className="sr-only">Ask AI: </span>
                    <StudyChatMarkdown text={turn.answer} />
                  </div>
                </div>
              ))}
              {pendingQuestion || failedRequest ? (
                <p className="ml-auto w-fit max-w-full rounded-xl bg-indigo-50 px-3 py-2 whitespace-pre-wrap wrap-break-word dark:bg-indigo-950/60">
                  <span className="sr-only">You: </span>{pendingQuestion || failedRequest?.question}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3 py-4">
              <h2 className="font-semibold">Ask anything about {title}</h2>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question) => (
                  <button
                    key={question}
                    type="button"
                    onClick={() => void sendQuestion({ requestId: crypto.randomUUID(), question })}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-left text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-[#1C2336]"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {pendingQuestion ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Getting an answer…</p> : null}
          {error ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300">
              <p role="alert">{error}</p>
              {failedRequest ? (
                <button type="button" disabled={busy} onClick={() => void sendQuestion(failedRequest)} className="font-semibold underline">
                  Retry question
                </button>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <label htmlFor="study-chat-question" className="sr-only">Question</label>
            <input
              id="study-chat-question"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              maxLength={MAX_CHAT_QUESTION_CHARS}
              disabled={busy}
              placeholder="Ask a question"
              className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-xl bg-[#494bd2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4B5CE8] disabled:opacity-50"
            >
              Send
            </button>
          </form>
          <ConfirmDialog
            open={confirmClear}
            title="Clear chat?"
            message="This removes the saved questions and answers for this set."
            confirmLabel="Clear chat"
            loading={clearing}
            onCancel={() => setConfirmClear(false)}
            onConfirm={clearChat}
          />
        </>
      ) : error ? (
        <div className="flex flex-wrap items-center gap-3 text-sm text-red-700 dark:text-red-300">
          <p role="alert">{error}</p>
          <button type="button" onClick={() => void loadChat()} className="font-semibold underline">Retry</button>
        </div>
      ) : (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-300">Loading chat…</p>
      )}
    </section>
  );
}
