import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Layers, Search, X } from "lucide-react";
import type { LibraryGuideSummary, LibrarySetSummary } from "@/src/types/api";

const filters = [
  { value: "all", label: "All" },
  { value: "sets", label: "Flashcards" },
  { value: "guides", label: "Study guides" },
] as const;
type Filter = typeof filters[number]["value"];

interface SearchItem {
  id: string;
  title: string;
  kind: "sets" | "guides";
  updatedAt: string;
  detail: string;
}

const previewLimit = 24;

export function MobileLibrarySearch({ initialQuery, onClose, onNavigate }: {
  initialQuery: string;
  onClose: () => void;
  onNavigate: (path: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const results = useRef<HTMLDivElement>(null);
  const term = query.trim().toLowerCase();

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setFailed(false);
    void (async () => {
      try {
        const response = await fetch("/api/library", { signal });
        if (!response.ok) throw new Error();
        const { sets, guides } = await response.json() as { sets: LibrarySetSummary[]; guides: LibraryGuideSummary[] };
        const cards = sets.map(({ id, title, cardCount, updatedAt }): SearchItem => ({
          id, title, kind: "sets", updatedAt, detail: `Flashcard set · ${cardCount} ${cardCount === 1 ? "card" : "cards"}`,
        }));
        const summaries = guides.map(({ id, title, termCount, updatedAt }): SearchItem => ({
          id, title, kind: "guides", updatedAt, detail: `Study guide · ${termCount} ${termCount === 1 ? "term" : "terms"}`,
        }));
        if (!signal.aborted) setItems([...cards, ...summaries].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)));
      } catch {
        if (!signal.aborted) setFailed(true);
      }
    })();
    return () => controller.abort();
  }, [retry]);

  useEffect(() => { if (results.current) results.current.scrollTop = 0; }, [term, filter]);

  const matches = items?.filter(({ kind, title }) => (filter === "all" || filter === kind) && title.toLowerCase().includes(term)) ?? [];

  function openLibrary() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (filter !== "all") params.set("type", filter);
    onNavigate(params.size ? `/library?${params}` : "/library");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-slate-200 bg-white pt-[max(.75rem,env(safe-area-inset-top))] dark:border-slate-800 dark:bg-[#141926]">
        <h2 id="mobile-navigation-title" className="sr-only">Search your library</h2>
        <div className="mx-auto max-w-xl px-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Back" onClick={onClose}
              className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]">
              <ArrowLeft aria-hidden="true" className="size-5" />
            </button>
            <form role="search" className="relative min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); input.current?.blur(); }}>
              <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
              <input ref={input} type="search" data-initial-focus="" aria-label="Search by title" enterKeyHint="search"
                value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your library" autoComplete="off"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-100 pl-10 pr-11 text-base [&::-webkit-search-cancel-button]:hidden dark:border-slate-700 dark:bg-[#0B0E17]" />
              {query && <button type="button" onClick={() => { setQuery(""); input.current?.focus(); }} aria-label="Clear search"
                className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                <X aria-hidden="true" className="size-4" />
              </button>}
            </form>
          </div>
          <div role="group" aria-label="Filter search results" className="flex flex-wrap gap-1.5 px-1 pt-3 pb-3.5">
            {filters.map(({ value, label }) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}
                className={`min-h-10 rounded-full border px-3.5 text-sm font-semibold ${filter === value
                  ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:border-indigo-400/30 dark:bg-indigo-400/15 dark:text-indigo-200"
                  : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-[#1C2336]"}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div ref={results} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
        <div className="mx-auto max-w-xl">
          {failed ? (
            <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-[#141926]">
              <p>Couldn’t load your library.</p>
              <button type="button" onClick={() => setRetry((value) => value + 1)}
                className="mt-1 min-h-11 font-semibold text-indigo-700 underline dark:text-indigo-300">Try again</button>
            </div>
          ) : !items ? <p role="status" className="text-sm text-slate-600 dark:text-slate-400">Loading your library…</p>
            : matches.length > 0 ? (
              <section aria-labelledby="mobile-search-results">
                <h3 id="mobile-search-results" aria-live="polite" className="mb-2.5 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {term ? `${matches.length} ${matches.length === 1 ? "result" : "results"}` : "Recently updated"}
                </h3>
                <ul className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#141926]">
                  {matches.slice(0, previewLimit).map(({ id, title, kind, detail }) => {
                    const Icon = kind === "sets" ? Layers : FileText;
                    return (
                      <li key={`${kind}:${id}`} className="border-b border-slate-200 last:border-0 dark:border-slate-800">
                        <button type="button" onClick={() => onNavigate(`/${kind}/${encodeURIComponent(id)}`)}
                          className="flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus-visible:outline-offset-[-2px] dark:hover:bg-[#1C2336]">
                          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${kind === "sets"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-400/15 dark:text-indigo-300"
                            : "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300"}`}>
                            <Icon aria-hidden="true" className="size-5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="line-clamp-2 text-sm font-semibold wrap-anywhere">{title}</span>
                            <span className="mt-0.5 block text-xs text-slate-600 dark:text-slate-400">{detail}</span>
                          </span>
                          <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {matches.length > previewLimit && <button type="button" onClick={openLibrary}
                  className="mt-3 min-h-11 w-full rounded-xl border border-slate-200 text-sm font-semibold text-indigo-700 dark:border-slate-700 dark:text-indigo-300">View all in library</button>}
              </section>
            ) : (
              <div role="status" className="rounded-2xl border border-dashed border-slate-200 px-4 py-9 text-center dark:border-slate-700">
                <Search aria-hidden="true" className="mx-auto mb-2 size-5 text-slate-500" />
                <p className="text-sm font-semibold">{term ? "No matches found" : items.length ? "Nothing in this category yet" : "Your library is empty"}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{term ? "Try a different title or search under All." : items.length ? "Select All to see your other materials." : "Create a flashcard set or generate a study guide to get started."}</p>
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
