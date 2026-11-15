import { useEffect, useState, type FormEvent } from "react";
import { ClipboardCheck } from "lucide-react";
import type { LibrarySetSummary } from "@/src/types/api";

export function PracticeTestView({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [decks, setDecks] = useState<LibrarySetSummary[] | null>(null);
  const [deckId, setDeckId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadDecks() {
      try {
        const res = await fetch("/api/library", { signal: controller.signal });
        if (!res.ok) throw new Error();
        const { sets } = (await res.json()) as { sets: LibrarySetSummary[] };
        if (!controller.signal.aborted) setDecks(sets.filter((set) => set.cardCount > 0));
      } catch {
        if (!controller.signal.aborted) setError("Could not load your flashcard sets. Reopen Practice test to retry.");
      }
    }
    void loadDecks();
    return () => controller.abort();
  }, []);

  function startTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deckId) onNavigate(`/sets/${encodeURIComponent(deckId)}?mode=test`);
  }

  return (
    <section className="mx-auto max-w-xl space-y-5">
      <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight">
        <ClipboardCheck aria-hidden="true" className="size-6 text-[#5B6CFA]" />
        Practice test
      </h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]">
        {error ? (
          <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>
        ) : decks === null ? (
          <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading flashcard sets…</p>
        ) : decks.length === 0 ? (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">Add a flashcard set before starting a test.</p>
            <button type="button" onClick={() => onNavigate("/sets/new")}
              className="mt-3 rounded-lg text-sm font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
              Create a flashcard set
            </button>
          </>
        ) : (
          <form onSubmit={startTest} className="space-y-4">
            <label htmlFor="practice-deck" className="block text-sm font-medium">Choose a flashcard set</label>
            <select id="practice-deck" required value={deckId} onChange={(event) => setDeckId(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-[#0B0E17]">
              <option value="" disabled>Select a set</option>
              {decks.map((deck) => (
                <option value={deck.id} key={deck.id}>{deck.title} ({deck.cardCount} cards)</option>
              ))}
            </select>
            <button type="submit" disabled={!deckId}
              className="rounded-xl bg-[#5B6CFA] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4B5CE8] disabled:opacity-50">
              Start test
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
