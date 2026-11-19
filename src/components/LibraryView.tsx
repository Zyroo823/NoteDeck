import { useEffect, useState, type KeyboardEvent } from "react";
import { FileText, Layers, Pencil, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { PracticeTestView } from "@/src/components/PracticeTestView";
import type { LibraryGuideSummary, LibrarySetSummary } from "@/src/types/api";

const libraryTabs = [
  { value: "all", label: "All" },
  { value: "sets", label: "Flashcards" },
  { value: "guides", label: "Study guides" },
  { value: "practice", label: "Practice Test" },
  { value: "activities", label: "Activities" },
] as const;

type LibraryTab = typeof libraryTabs[number]["value"];

interface LibraryViewProps {
  initialQuery: string;
  activeTab: LibraryTab;
  onNavigate: (path: string) => void;
  onOpenGenerate: () => void;
}

export function LibraryView({
  initialQuery,
  activeTab,
  onNavigate,
  onOpenGenerate,
}: LibraryViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const browseLibrary = activeTab !== "practice" && activeTab !== "activities";
  const [sets, setSets] = useState<LibrarySetSummary[]>([]);
  const [guides, setGuides] = useState<LibraryGuideSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: "set" | "guide";
    id: string;
    title: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!browseLibrary) return;
    let active = true;
    async function loadLibrary() {
      setLoading(true);
      setErrorMessage("");
      try {
        const endpoint = query.trim()
          ? `/api/library?q=${encodeURIComponent(query.trim())}`
          : "/api/library";
        const res = await fetch(endpoint);
        const data = (await res.json()) as {
          sets?: LibrarySetSummary[];
          guides?: LibraryGuideSummary[];
          error?: string;
        };
        if (!res.ok) {
          if (active) setErrorMessage(data.error ?? "Failed to load your library.");
          return;
        }
        if (active) {
          setSets(data.sets ?? []);
          setGuides(data.guides ?? []);
        }
      } catch {
        if (active) setErrorMessage("Network error while loading your library.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadLibrary();
    return () => {
      active = false;
    };
  }, [browseLibrary, query]);

  function selectTab(tab: LibraryTab) {
    if (tab === activeTab) return;
    const params = new URLSearchParams();
    if (tab !== "all" && tab !== "practice") params.set("type", tab);
    if (query.trim()) params.set("q", query.trim());
    const path = tab === "practice" ? "/practice-test" : "/library";
    onNavigate(params.size ? `${path}?${params}` : path);
  }

  function moveTabFocus(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=tab]"));
    const index = tabs.findIndex((tab) => tab === event.target);
    if (index === -1) return;
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
      : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]?.focus();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const endpoint =
        deleteTarget.kind === "set"
          ? `/api/sets/${deleteTarget.id}`
          : `/api/guides/${deleteTarget.id}`;
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to delete item.");
        return;
      }
      if (deleteTarget.kind === "set") {
        setSets((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      } else {
        setGuides((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      }
      setDeleteTarget(null);
    } catch {
      setErrorMessage("Network error while deleting item.");
    } finally {
      setDeleting(false);
    }
  }

  const showSets = activeTab === "all" || activeTab === "sets";
  const showGuides = activeTab === "all" || activeTab === "guides";
  const visibleSets = showSets ? sets : [];
  const visibleGuides = showGuides ? guides : [];
  const isEmpty = !loading && visibleSets.length === 0 && visibleGuides.length === 0;
  const panel = { role: "tabpanel", id: "library-panel", "aria-labelledby": `library-tab-${activeTab}`, tabIndex: 0 } as const;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your library</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Search, open, edit, and organize your personal sets and study guides.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onOpenGenerate}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
          >
            <Sparkles className="h-4 w-4 text-[#2DD4BF]" />
            Generate with AI
          </button>

          <button
            type="button"
            onClick={() => onNavigate("/sets/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8]"
          >
            <Plus className="h-4 w-4" />
            Create flashcard set
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex max-w-full flex-wrap items-center self-start rounded-xl bg-slate-200/70 p-1 dark:bg-[#141926]">
          <div role="tablist" aria-label="Library sections" onKeyDown={moveTabFocus} className="flex max-w-full flex-wrap">
            {libraryTabs.map(({ value, label }) => (
              <button key={value} id={`library-tab-${value}`} type="button" role="tab" aria-selected={activeTab === value}
                aria-controls="library-panel" tabIndex={activeTab === value ? 0 : -1} onClick={() => selectTab(value)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  activeTab === value
                    ? "bg-white text-slate-900 shadow-sm dark:bg-[#1C2336] dark:text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}>
                {label}
                {value === "activities" && <span className="rounded-md bg-slate-300/50 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-[#0B0E17] dark:text-slate-300">Soon</span>}
              </button>
            ))}
          </div>
        </div>

        {browseLibrary && <div className="relative w-full shrink-0 sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            aria-label="Filter library by title"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by title..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100"
          />
        </div>}
      </div>

      {activeTab === "practice" && <div {...panel}><PracticeTestView onNavigate={onNavigate} /></div>}
      {activeTab === "activities" && (
        <section {...panel} className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
          <h2 className="text-lg font-semibold">Activities are coming soon</h2>
        </section>
      )}

      {browseLibrary && errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {browseLibrary && (loading ? (
        <div {...panel} className="grid gap-4 sm:grid-cols-2">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
        </div>
      ) : isEmpty ? (
        <div {...panel} className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#141926]">
          <Layers className="mx-auto h-8 w-8 text-slate-500" />
          <h2 className="mt-3 text-lg font-semibold">No matching items found</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {query.trim()
              ? "Try another keyword or clear your search filter."
              : "Create a flashcard set or generate study materials from your notes."}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("/sets/new")}
              className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#4B5CE8]"
            >
              <Plus className="h-4 w-4" />
              Create flashcard set
            </button>
          </div>
        </div>
      ) : (
        <div {...panel} className="space-y-8">
          {visibleSets.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Flashcard sets (<span className="font-mono-nums">{visibleSets.length}</span>)
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleSets.map((item) => (
                  <article
                    key={item.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#5B6CFA]/50 dark:border-slate-800 dark:bg-[#141926]"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(`/sets/${item.id}`)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA]"
                    >
                      <h3 className="line-clamp-2 wrap-anywhere text-base font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <Layers className="h-3.5 w-3.5 text-[#5B6CFA]" />
                        <span className="font-mono-nums">{item.cardCount} cards</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.sourceType === "ai" ? "AI generated" : "Manual"}</span>
                      </div>
                    </button>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onNavigate(`/sets/${item.id}/edit`)}
                        aria-label={`Edit "${item.title}"`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-[#1C2336] dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({ kind: "set", id: item.id, title: item.title })
                        }
                        aria-label={`Delete "${item.title}"`}
                        className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          {visibleGuides.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                Study guides (<span className="font-mono-nums">{visibleGuides.length}</span>)
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {visibleGuides.map((guide) => (
                  <article
                    key={guide.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-[#2DD4BF]/50 dark:border-slate-800 dark:bg-[#141926]"
                  >
                    <button
                      type="button"
                      onClick={() => onNavigate(`/guides/${guide.id}`)}
                      className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2DD4BF]"
                    >
                      <h3 className="line-clamp-2 wrap-anywhere text-base font-bold text-slate-900 dark:text-white">
                        {guide.title}
                      </h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <FileText className="h-3.5 w-3.5 text-[#2DD4BF]" />
                        <span className="font-mono-nums">{guide.conceptCount} concepts</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-nums">{guide.termCount} key terms</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDeleteTarget({ kind: "guide", id: guide.id, title: guide.title })
                      }
                      aria-label={`Delete "${guide.title}"`}
                      className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ))}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget?.kind === "guide" ? "Delete study guide" : "Delete flashcard set"}
        message={`Delete "${deleteTarget?.title ?? ""}" permanently? This action cannot be undone.`}
        confirmLabel={deleteTarget?.kind === "guide" ? "Delete guide" : "Delete set"}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
