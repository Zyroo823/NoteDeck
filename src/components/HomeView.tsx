import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileText, Layers, Plus, Sparkles } from "lucide-react";
import type { JumpBackInItem, RecentActivityItem } from "@/src/types/api";

interface HomeViewProps {
  onNavigate: (path: string) => void;
  onOpenGenerate: () => void;
}

export function HomeView({ onNavigate, onOpenGenerate }: HomeViewProps) {
  const [jumpBackIn, setJumpBackIn] = useState<JumpBackInItem[]>([]);
  const [recents, setRecents] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    async function loadHome() {
      setLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch("/api/home");
        const data = (await res.json()) as {
          jumpBackIn?: JumpBackInItem[];
          recents?: RecentActivityItem[];
          error?: string;
        };
        if (!res.ok) {
          if (active) setErrorMessage(data.error ?? "Failed to load your dashboard.");
          return;
        }
        if (active) {
          setJumpBackIn(data.jumpBackIn ?? []);
          setRecents(data.recents ?? []);
        }
      } catch {
        if (active) setErrorMessage("Network error while loading your dashboard.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadHome();
    return () => {
      active = false;
    };
  }, []);

  function scrollCarousel(direction: -1 | 1) {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: direction * 340, behavior: "smooth" });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <section aria-labelledby="jump-back-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h1 id="jump-back-heading" className="text-xl font-bold tracking-tight">
            Jump back in
          </h1>

          {jumpBackIn.length > 1 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCarousel(-1)}
                aria-label="Scroll carousel left"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel(1)}
                aria-label="Scroll carousel right"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
          </div>
        ) : jumpBackIn.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 dark:border-slate-800 dark:bg-[#141926]">
            <h2 className="text-lg font-bold">Start building your study library</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              Create flashcards manually or paste your lecture notes and slides to generate flashcards and a study guide automatically.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onOpenGenerate}
                className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8]"
              >
                <Sparkles className="h-4 w-4" />
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => onNavigate("/sets/new")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-[#1C2336]"
              >
                <Plus className="h-4 w-4" />
                Create flashcard set
              </button>
            </div>
          </div>
        ) : (
          <div
            ref={carouselRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
          >
            {jumpBackIn.map((item) => (
              <article
                key={item.id}
                className="flex min-w-[290px] max-w-[380px] flex-1 shrink-0 snap-start flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]"
              >
                <div>
                  <h2 className="line-clamp-2 text-lg font-bold leading-snug text-slate-900 dark:text-white">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {item.lastScorePct !== null ? (
                      <>
                        You got{" "}
                        <span className="font-mono-nums font-semibold text-slate-900 dark:text-white">
                          {item.lastScorePct}%
                        </span>{" "}
                        on your last test
                      </>
                    ) : (
                      <>
                        <span className="font-mono-nums font-semibold text-slate-900 dark:text-white">
                          {item.cardCount}
                        </span>{" "}
                        cards ready to review
                      </>
                    )}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate(
                        item.lastScorePct !== null
                          ? `/sets/${item.id}?mode=test`
                          : `/sets/${item.id}`
                      )
                    }
                    className="rounded-full bg-[#494bd2] px-4 py-2 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA]"
                  >
                    {item.lastScorePct !== null ? "Start another test" : "Continue"}
                  </button>

                  <span className="font-mono-nums text-xs text-slate-500 dark:text-slate-400">
                    {item.cardCount} {item.cardCount === 1 ? "card" : "cards"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="recents-heading" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 id="recents-heading" className="text-xl font-bold tracking-tight">
            Recents
          </h2>
          {recents.length > 0 ? (
            <button
              type="button"
              onClick={() => onNavigate("/library")}
              className="text-sm font-semibold text-[#494bd2] hover:underline whitespace-nowrap dark:text-[#a5b4fc]"
            >
              View all
            </button>
          ) : null}
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
          </div>
        ) : recents.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Recent flashcard sets and study guides will appear here once created.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recents.map((item) => (
              <button
                key={`${item.kind}-${item.id}`}
                type="button"
                onClick={() =>
                  onNavigate(item.kind === "set" ? `/sets/${item.id}` : `/guides/${item.id}`)
                }
                className="flex w-full min-w-0 items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition hover:border-[#5B6CFA]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    item.kind === "set"
                      ? "bg-[#5B6CFA]/15 text-[#5B6CFA]"
                      : "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                  }`}
                >
                  {item.kind === "set" ? (
                    <Layers className="h-5 w-5" />
                  ) : (
                    <FileText className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-mono-nums">
                      {item.kind === "set"
                        ? `${item.cardCount} ${item.cardCount === 1 ? "card" : "cards"}`
                        : "Study guide"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>by you</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
