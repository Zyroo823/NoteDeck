import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { ArrowUp, BookOpen, MessageCircle, Minus, Sparkles, Trash2, X } from "lucide-react";
import { ASSISTANT_HISTORY_TURNS, MAX_ASSISTANT_QUESTION, materialFromPath, type AssistantMaterial, type AssistantTurn } from "@/src/chatbot/assistant";
import { answerGuestFaq, assistantFaq } from "@/src/chatbot/knowledge";
import { StudyChatMarkdown } from "@/src/components/StudyChatMarkdown";

const SESSION_KEY = "notedeck-assistant-open";
const LAUNCH_LABEL = "Ask NoteDeck Assistant";
const studyPrompts = ["Explain this simply", "Make 5 practice questions", "What are the key terms?", "Quiz me on this material"];
const iconButton = "grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-[#1C2336]";
const primaryButton = "bg-[#494bd2] text-white hover:bg-[#3739aa] active:bg-[#303296] disabled:opacity-50";

function readOpenPreference() {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(SESSION_KEY) === "true"; } catch { return false; }
}

interface AssistantFrameProps {
  children: ReactNode;
  pageRef: RefObject<HTMLDivElement | null>;
  pathname: string;
  userId?: string;
  onNavigate: (path: string) => void;
}

export function AssistantFrame({ children, pageRef, pathname, userId, onNavigate }: AssistantFrameProps) {
  const [open, setOpen] = useState(readOpenPreference);
  const [seen, setSeen] = useState(open);
  const frame = useRef<HTMLDivElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const material = userId ? materialFromPath(pathname) : undefined;

  useLayoutEffect(() => {
    const dialog = panel.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      title.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      launcher.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    const dialog = panel.current;
    const viewport = window.visualViewport;
    if (!open || !dialog || !viewport) return;
    // Some mobile browsers resize only the visible viewport when the keyboard opens.
    function fitVisibleViewport() {
      if (!dialog || !viewport || viewport.scale !== 1) return;
      const keyboard = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      dialog.style.setProperty("--assistant-keyboard", `${keyboard}px`);
      dialog.style.setProperty("--assistant-visible-height", `${viewport.height}px`);
    }
    fitVisibleViewport();
    viewport.addEventListener("resize", fitVisibleViewport);
    viewport.addEventListener("scroll", fitVisibleViewport);
    return () => {
      viewport.removeEventListener("resize", fitVisibleViewport);
      viewport.removeEventListener("scroll", fitVisibleViewport);
      dialog.style.removeProperty("--assistant-keyboard");
      dialog.style.removeProperty("--assistant-visible-height");
    };
  }, [open]);

  useEffect(() => {
    // Fixed bars and toasts can opt in to reserve space when they appear or resize.
    const root = frame.current;
    const page = pageRef.current;
    if (!root || !page) return;
    let obstructions: Element[] = [];
    function positionLauncher() {
      let lift = 0;
      for (const node of obstructions) {
        const { top, bottom, right, left, height } = node.getBoundingClientRect();
        if (height && bottom > 0 && top >= window.innerHeight / 2 && top < window.innerHeight &&
            right > window.innerWidth - 100 && left < window.innerWidth) {
          lift = Math.max(lift, window.innerHeight - top);
        }
      }
      root?.style.setProperty("--assistant-lift", `${lift}px`);
    }
    const resize = new ResizeObserver(positionLauncher);
    function trackObstructions() {
      const next = Array.from(page?.querySelectorAll("[data-assistant-bottom-obstruction]") ?? []);
      if (next.length === obstructions.length && next.every((node, index) => node === obstructions[index])) return;
      resize.disconnect();
      obstructions = next;
      obstructions.forEach((node) => resize.observe(node));
      positionLauncher();
    }
    const mutations = new MutationObserver(trackObstructions);
    mutations.observe(page, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-assistant-bottom-obstruction"] });
    trackObstructions();
    window.addEventListener("resize", positionLauncher);
    page.addEventListener("transitionend", positionLauncher);
    return () => {
      mutations.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", positionLauncher);
      page.removeEventListener("transitionend", positionLauncher);
    };
  }, [pageRef]);

  function setPanelOpen(next: boolean) {
    setOpen(next);
    if (next) setSeen(true);
    try { window.sessionStorage.setItem(SESSION_KEY, String(next)); } catch { /* Storage may be blocked. */ }
  }

  function handleDialogKeys(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), textarea:not(:disabled), a[href]",
    )).filter((element) => element.getClientRects().length > 0);
    const first = controls[0];
    const last = controls.at(-1);
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === title.current)) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (active === last || active === title.current)) {
      event.preventDefault();
      first?.focus();
    }
  }

  function navigate(path: string) {
    setPanelOpen(false);
    onNavigate(path);
  }

  return (
    <div ref={frame} className="assistant-frame bg-slate-50 text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <div ref={pageRef} className="assistant-page">{children}</div>
      <div className="assistant-launcher group">
        <button ref={launcher} type="button" aria-label={LAUNCH_LABEL} aria-expanded={open} aria-controls="notedeck-assistant"
          onClick={() => setPanelOpen(true)}
          className={`${primaryButton} relative grid size-14 place-items-center rounded-full shadow-lg shadow-indigo-950/25 motion-safe:transition-colors`}>
          <MessageCircle className="size-6" aria-hidden="true" />
          {!seen && <span aria-hidden="true" className="absolute right-1 top-1 size-3 rounded-full border-2 border-[#494bd2] bg-amber-300" />}
        </button>
        <span aria-hidden="true" className="pointer-events-none absolute right-0 bottom-full mb-2 hidden w-max rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white group-focus-within:block group-hover:block">
          {LAUNCH_LABEL}
        </span>
      </div>

      <dialog ref={panel} id="notedeck-assistant" aria-labelledby="notedeck-assistant-title" aria-modal="true"
        onKeyDown={handleDialogKeys}
        onCancel={(event) => { event.preventDefault(); setPanelOpen(false); }}
        className="assistant-dialog border border-slate-200 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/45 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100">
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300">
              <Sparkles aria-hidden="true" className="size-4" />
            </span>
            <h2 ref={title} tabIndex={-1} id="notedeck-assistant-title" className="mr-auto text-sm font-bold">NoteDeck Assistant</h2>
            <button type="button" aria-label="Minimize assistant" title="Minimize" onClick={() => setPanelOpen(false)} className={iconButton}>
              <Minus aria-hidden="true" className="size-5" />
            </button>
            <button type="button" aria-label="Close assistant" title="Close" onClick={() => setPanelOpen(false)} className={iconButton}>
              <X aria-hidden="true" className="size-5" />
            </button>
          </header>
          <AssistantConversation key={JSON.stringify([userId, material])} open={open} signedIn={Boolean(userId)} material={material} onNavigate={navigate} />
        </div>
      </dialog>
    </div>
  );
}

interface ConversationProps {
  open: boolean;
  signedIn: boolean;
  material?: AssistantMaterial;
  onNavigate: (path: string) => void;
}

function AssistantConversation({ open, signedIn, material, onNavigate }: ConversationProps) {
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const request = useRef<AbortController | null>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const prompts = material ? studyPrompts : assistantFaq.slice(0, 4).map(({ question }) => question);

  useEffect(() => () => request.current?.abort(), []);
  useLayoutEffect(() => {
    if (open && transcript.current) transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [open, turns, pending, error]);

  async function send(raw: string) {
    const question = raw.trim();
    if (!question || question.length > MAX_ASSISTANT_QUESTION || request.current) return;
    setDraft("");
    setError("");
    setAnnouncement("");
    if (!signedIn) {
      setTurns((previous) => [...previous, { question, answer: answerGuestFaq(question) }]);
      return;
    }

    const controller = new AbortController();
    request.current = controller;
    setPending(question);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, material, history: turns.slice(-ASSISTANT_HISTORY_TURNS) }),
        signal: controller.signal,
      });
      const payload = await response.json() as { answer?: string; error?: string };
      if (controller.signal.aborted) return;
      if (!response.ok || typeof payload.answer !== "string" || !payload.answer.trim()) {
        setError(response.status === 401 ? "Your session ended. Sign in again to continue." : payload.error || "The assistant couldn’t reply. Try again.");
        return;
      }
      const answer = payload.answer;
      setTurns((previous) => [...previous, { question, answer }]);
      setPending("");
    } catch {
      if (!controller.signal.aborted) setError("The connection was interrupted. Try again.");
    } finally {
      if (request.current === controller) request.current = null;
    }
  }

  function clearChat() {
    request.current?.abort();
    request.current = null;
    setTurns([]);
    setDraft("");
    setPending("");
    setError("");
    setAnnouncement("Chat cleared.");
    composer.current?.focus();
  }

  function handleComposerKeys(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void send(draft);
    }
  }

  const empty = turns.length === 0 && !pending;
  const loading = Boolean(pending && !error);
  return (
    <>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <span className="flex items-center gap-1.5 font-medium">
          <BookOpen aria-hidden="true" className="size-3.5" />
          {material?.kind === "guide" ? "Open study guide" : material ? "Open flashcard set" : "NoteDeck help"}
        </span>
        <button type="button" onClick={clearChat} disabled={empty && !draft}
          className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 font-semibold hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-[#1C2336]">
          <Trash2 aria-hidden="true" className="size-3.5" /> Clear chat
        </button>
      </div>

      <div ref={transcript} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4" data-assistant-transcript>
        {empty && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold tracking-tight">{material ? "Study this material" : "How can I help?"}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                {material ? "Ask for an explanation, summary, or quick quiz." : "Ask how to use NoteDeck or pick something to study."}
              </p>
            </div>
            <div className="grid gap-2">
              {prompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => { composer.current?.focus(); void send(prompt); }}
                  className="min-h-10 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100 dark:border-slate-700 dark:hover:border-indigo-500 dark:hover:bg-[#1C2336]">
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        <div role="log" aria-label="Assistant conversation" className="space-y-3">
          {turns.map(({ question, answer }, index) => (
            <div key={index} className="space-y-2">
              <UserBubble question={question} />
              <div className="mr-6 rounded-2xl rounded-tl-md bg-slate-100 px-3 py-2.5 text-sm break-words dark:bg-[#1C2336]">
                <span className="sr-only">Assistant: </span>
                <StudyChatMarkdown text={answer} allowLinks={false} />
              </div>
            </div>
          ))}
          {pending && <UserBubble question={pending} />}
        </div>
        {loading && (
          <p role="status" className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className="mr-2 inline-block size-2 rounded-full bg-indigo-500 motion-safe:animate-pulse" />
            Assistant is typing…
          </p>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <p role="alert">{error}</p>
            <button type="button" onClick={() => { composer.current?.focus(); void send(pending); }} className="mt-1 min-h-9 rounded-md font-semibold underline">Retry</button>
          </div>
        )}
      </div>

      <div className="assistant-compose shrink-0 border-t border-slate-200 px-3 pt-2.5 dark:border-slate-800">
        {!material && (
          <button type="button" onClick={() => onNavigate(signedIn ? "/library" : "/login")}
            className="mb-2 min-h-8 rounded-md px-1 text-xs font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            {signedIn ? "Choose material from Library" : "Sign in to ask about your materials"}
          </button>
        )}
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void send(draft); }}>
          <textarea ref={composer} aria-label="Message" rows={2} maxLength={MAX_ASSISTANT_QUESTION}
            placeholder={material ? "Ask about this material…" : "Ask about NoteDeck…"} value={draft}
            onChange={(event) => setDraft(event.target.value)} onKeyDown={handleComposerKeys}
            className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base sm:text-sm dark:border-slate-700 dark:bg-[#0B0E17]" />
          <button type="submit" aria-label="Send message" disabled={!draft.trim() || loading} className={`${primaryButton} grid size-11 shrink-0 place-items-center rounded-xl`}>
            <ArrowUp aria-hidden="true" className="size-5" />
          </button>
        </form>
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          {signedIn ? "Messages and relevant study context are sent to Gemini." : "Browse the public FAQ without signing in."}
        </p>
        <p role="status" className="sr-only">{announcement}</p>
      </div>
    </>
  );
}

function UserBubble({ question }: { question: string }) {
  return (
    <p className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-tr-md bg-[#494bd2] px-3 py-2.5 text-sm break-words whitespace-pre-wrap text-white">
      <span className="sr-only">You: </span>{question}
    </p>
  );
}
