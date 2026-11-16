import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { studySetInputSchema, type CardInput } from "@/src/lib/schemas";
import type { StudySetDetail } from "@/src/types/api";

interface SetFormViewProps {
  mode: "create" | "edit";
  setId?: string;
  onNavigate: (path: string) => void;
}

const INITIAL_CARDS: CardInput[] = [
  { term: "", definition: "" },
  { term: "", definition: "" },
  { term: "", definition: "" },
];

export function SetFormView({ mode, setId, onNavigate }: SetFormViewProps) {
  const [title, setTitle] = useState("");
  const [cards, setCards] = useState<CardInput[]>(INITIAL_CARDS);
  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (mode !== "edit" || !setId) return;
    let active = true;
    async function loadExisting() {
      setLoading(true);
      try {
        const res = await fetch(`/api/sets/${setId}`);
        const data = (await res.json()) as StudySetDetail & { error?: string };
        if (!res.ok) {
          if (active) setErrorMessage(data.error ?? "Could not load study set.");
          return;
        }
        if (active) {
          setTitle(data.set.title);
          setCards(
            data.cards.length > 0
              ? data.cards.map((c) => ({ term: c.term, definition: c.definition }))
              : [{ term: "", definition: "" }]
          );
        }
      } catch {
        if (active) setErrorMessage("Network error while loading study set.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadExisting();
    return () => {
      active = false;
    };
  }, [mode, setId]);

  function updateRow(index: number, field: "term" | "definition", value: string) {
    setCards((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    );
  }

  function addRow() {
    setCards((prev) => [...prev, { term: "", definition: "" }]);
  }

  function removeRow(index: number) {
    if (cards.length <= 1) return;
    setCards((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const nonEmpty = cards.filter(
      (item) => item.term.trim().length > 0 || item.definition.trim().length > 0
    );
    const candidate = {
      title,
      cards: nonEmpty.length > 0 ? nonEmpty : cards,
    };

    const parsed = studySetInputSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Check your set fields.");
      return;
    }

    setSaving(true);
    try {
      const endpoint = mode === "create" ? "/api/sets" : `/api/sets/${setId}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { set?: { id: string }; error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Failed to save study set.");
        return;
      }
      const nextId = mode === "create" ? data.set?.id : setId;
      onNavigate(`/sets/${nextId}`);
    } catch {
      setErrorMessage("Network error while saving study set.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="h-12 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
        <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6" noValidate>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate(mode === "edit" && setId ? `/sets/${setId}` : "/library")}
            aria-label="Go back"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {mode === "create" ? "Create a new flashcard set" : "Edit flashcard set"}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Add terms and definitions to study with flashcards and practice quizzes.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#494bd2] px-5 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:opacity-60"
        >
          {saving ? "Saving..." : mode === "create" ? "Create set" : "Save changes"}
        </button>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]">
        <label htmlFor="set-title-input" className="mb-2 block text-sm font-semibold">
          Title
        </label>
        <input
          id="set-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Example: Biology Chapter 4 Cell Transport"
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
        />
      </div>

      <div className="space-y-4">
        {cards.map((card, index) => (
          <div
            key={index}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono-nums text-xs font-semibold text-slate-500 dark:text-slate-400">
                Card {index + 1}
              </span>
              <button
                type="button"
                onClick={() => removeRow(index)}
                disabled={cards.length <= 1}
                aria-label={`Remove card ${index + 1}`}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor={`card-term-${index}`}
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  Term
                </label>
                <textarea
                  id={`card-term-${index}`}
                  rows={2}
                  value={card.term}
                  onChange={(e) => updateRow(index, "term", e.target.value)}
                  placeholder="Enter term"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label
                  htmlFor={`card-def-${index}`}
                  className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400"
                >
                  Definition
                </label>
                <textarea
                  id={`card-def-${index}`}
                  rows={2}
                  value={card.definition}
                  onChange={(e) => updateRow(index, "definition", e.target.value)}
                  placeholder="Enter definition"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 whitespace-nowrap transition hover:border-[#494bd2] hover:text-[#494bd2] dark:border-slate-700 dark:text-slate-200 dark:hover:border-[#a5b4fc] dark:hover:text-[#a5b4fc]"
        >
          <Plus className="h-4 w-4" />
          Add card
        </button>

        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-[#494bd2] px-6 py-3 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:opacity-60"
        >
          {saving ? "Saving..." : mode === "create" ? "Create set" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
