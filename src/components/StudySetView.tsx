import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ClipboardCheck, Ellipsis, FileText, Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import { cardInputSchema } from "@/src/lib/schemas";
import { FlashcardViewer } from "@/src/components/FlashcardViewer";
import { StudyChat } from "@/src/components/StudyChat";
import { TestMode } from "@/src/components/TestMode";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import type { StudySetDetail } from "@/src/types/api";
import type { StudyCardItem } from "@/src/lib/studyLogic";

interface StudySetViewProps {
  setId: string;
  initialMode: "flashcards" | "test";
  onNavigate: (path: string) => void;
}

const studyModes = [
  { id: "flashcards", label: "Flashcards", icon: Layers },
  { id: "test", label: "Test", icon: ClipboardCheck },
  { id: "chat", label: "Ask AI" },
] as const;

export function StudySetView({ setId, initialMode, onNavigate }: StudySetViewProps) {
  const [detail, setDetail] = useState<StudySetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [mode, setMode] = useState<"flashcards" | "test" | "chat">(initialMode);
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [revealedCardIds, setRevealedCardIds] = useState<Set<string>>(() => new Set());
  const actionsRef = useRef<HTMLDetailsElement>(null);
  const actionsTrigger = useRef<HTMLElement>(null);

  // Inline card editing state
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editTerm, setEditTerm] = useState("");
  const [editDef, setEditDef] = useState("");
  const [cardError, setCardError] = useState("");
  const [savingCard, setSavingCard] = useState(false);

  // Inline add card state
  const [addingCard, setAddingCard] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDef, setNewDef] = useState("");

  // Delete confirmations
  const [deleteSetOpen, setDeleteSetOpen] = useState(false);
  const [deleteCardTarget, setDeleteCardTarget] = useState<StudyCardItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode, setId]);

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const actions = actionsRef.current;
      if (actions?.open && event.target instanceof Node && !actions.contains(event.target)) actions.open = false;
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowLeft": nextIndex = (index + studyModes.length - 1) % studyModes.length; break;
      case "ArrowRight": nextIndex = (index + 1) % studyModes.length; break;
      case "Home": nextIndex = 0; break;
      case "End": nextIndex = studyModes.length - 1; break;
      default: return;
    }
    event.preventDefault();
    const nextMode = studyModes[nextIndex].id;
    setMode(nextMode);
    document.getElementById(`study-tab-${nextMode}`)?.focus();
  }

  const loadSet = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setErrorMessage("");
    try {
      const res = await fetch(`/api/sets/${setId}`);
      const data = (await res.json()) as StudySetDetail & { error?: string };
      if (!res.ok) {
        setErrorMessage(data.error ?? "Failed to load study set.");
        return;
      }
      setDetail(data);
    } catch {
      setErrorMessage("Network error while loading study set.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [setId]);

  useEffect(() => {
    setShowDefinitions(false);
    setRevealedCardIds(new Set());
    void loadSet();
  }, [loadSet]);

  function toggleDefinition(cardId: string) {
    setRevealedCardIds((previous) => {
      const next = new Set(previous);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  }

  async function handleDeleteSet() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sets/${setId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to delete set.");
        return;
      }
      onNavigate("/library");
    } catch {
      setErrorMessage("Network error while deleting set.");
    } finally {
      setDeleting(false);
      setDeleteSetOpen(false);
    }
  }

  function startEditCard(card: StudyCardItem) {
    setEditingCardId(card.id);
    setEditTerm(card.term);
    setEditDef(card.definition);
    setCardError("");
  }

  async function handleSaveInlineCard(cardId: string) {
    setCardError("");
    const parsed = cardInputSchema.safeParse({ term: editTerm, definition: editDef });
    if (!parsed.success) {
      setCardError(parsed.error.issues[0]?.message ?? "Check term and definition.");
      return;
    }

    setSavingCard(true);
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { card?: StudyCardItem; error?: string };
      if (!res.ok || !data.card) {
        setCardError(data.error ?? "Failed to update card.");
        return;
      }
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              cards: prev.cards.map((c) => (c.id === cardId ? data.card! : c)),
            }
          : prev
      );
      setEditingCardId(null);
    } catch {
      setCardError("Network error while updating card.");
    } finally {
      setSavingCard(false);
    }
  }

  async function handleAddInlineCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCardError("");
    const parsed = cardInputSchema.safeParse({ term: newTerm, definition: newDef });
    if (!parsed.success) {
      setCardError(parsed.error.issues[0]?.message ?? "Enter both term and definition.");
      return;
    }

    setSavingCard(true);
    try {
      const res = await fetch(`/api/sets/${setId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { card?: StudyCardItem; error?: string };
      if (!res.ok || !data.card) {
        setCardError(data.error ?? "Failed to add card.");
        return;
      }
      setDetail((prev) =>
        prev ? { ...prev, cards: [...prev.cards, data.card!] } : prev
      );
      setNewTerm("");
      setNewDef("");
      setAddingCard(false);
    } catch {
      setCardError("Network error while adding card.");
    } finally {
      setSavingCard(false);
    }
  }

  async function handleConfirmDeleteCard() {
    if (!deleteCardTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/cards/${deleteCardTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setCardError(data.error ?? "Failed to delete card.");
        return;
      }
      setDetail((prev) =>
        prev
          ? { ...prev, cards: prev.cards.filter((c) => c.id !== deleteCardTarget.id) }
          : prev
      );
      setDeleteCardTarget(null);
    } catch {
      setCardError("Network error while deleting card.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 max-w-full animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
        <div className="h-80 animate-pulse rounded-3xl bg-slate-200 dark:bg-[#141926]" />
      </div>
    );
  }

  if (errorMessage || !detail) {
    return (
      <div className="rounded-2xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          {errorMessage || "Study set not found."}
        </p>
        <button
          type="button"
          onClick={() => onNavigate("/library")}
          className="mt-4 rounded-xl bg-[#494bd2] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Your library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div className="min-w-0 sm:flex-1">
          <h1 className="wrap-anywhere text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {detail.set.title}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <span className="wrap-anywhere">Created by {detail.creatorName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-nums">{detail.cards.length} terms</span>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          {detail.linkedGuideId ? (
            <button
              type="button"
              onClick={() => onNavigate(`/guides/${detail.linkedGuideId}`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
            >
              <FileText className="h-4 w-4 text-[#2DD4BF]" />
              Study guide
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onNavigate(`/sets/${setId}/edit`)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>

          <details ref={actionsRef}
            className="relative"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.preventDefault();
                actionsTrigger.current?.focus();
                event.currentTarget.open = false;
              }
            }}>
            <summary ref={actionsTrigger} aria-label="More set actions"
              className="grid size-10 cursor-pointer list-none place-items-center rounded-xl border border-slate-300 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336] [&::-webkit-details-marker]:hidden">
              <Ellipsis aria-hidden="true" className="size-5" />
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-[#141926]">
              <button type="button" onClick={() => {
                actionsTrigger.current?.focus();
                if (actionsRef.current) actionsRef.current.open = false;
                setDeleteSetOpen(true);
              }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40">
                <Trash2 aria-hidden="true" className="size-4" />
                Delete set
              </button>
            </div>
          </details>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Study mode"
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        {studyModes.map((tab, index) => {
          const Icon = "icon" in tab ? tab.icon : undefined;
          return (
            <button key={tab.id} id={`study-tab-${tab.id}`} type="button" role="tab"
              aria-selected={mode === tab.id} aria-controls={`study-panel-${tab.id}`}
              tabIndex={mode === tab.id ? 0 : -1}
              onClick={() => setMode(tab.id)} onKeyDown={(event) => handleTabKey(event, index)}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition ${
                mode === tab.id
                  ? "border-indigo-500 bg-indigo-50 text-indigo-800 dark:border-indigo-400 dark:bg-indigo-500/15 dark:text-indigo-200"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
              }`}>
              {Icon && <Icon aria-hidden="true" className="hidden size-4 sm:block" />}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div id="study-panel-flashcards" role="tabpanel" aria-labelledby="study-tab-flashcards" hidden={mode !== "flashcards"}>
        {mode === "flashcards" && <FlashcardViewer cards={detail.cards} />}
      </div>
      <div id="study-panel-test" role="tabpanel" aria-labelledby="study-tab-test" hidden={mode !== "test"}>
        <TestMode
          key={setId}
          setId={setId}
          cards={detail.cards}
          onAttemptSaved={() => {
            void loadSet(true);
          }}
        />
      </div>
      <div id="study-panel-chat" role="tabpanel" aria-labelledby="study-tab-chat" hidden={mode !== "chat"}>
        {mode === "chat" && <StudyChat key={setId} setId={setId} title={detail.set.title} />}
      </div>

      <section hidden={mode !== "flashcards"} aria-labelledby="terms-list-heading" className="space-y-4 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="terms-list-heading" className="text-lg font-bold">
            Terms in this set (<span className="font-mono-nums">{detail.cards.length}</span>)
          </h2>

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={showDefinitions}
                onChange={(event) => {
                  setShowDefinitions(event.target.checked);
                  setRevealedCardIds(new Set());
                }}
                className="size-4 shrink-0 accent-[#494bd2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4547cd]"
              />
              Show definitions
            </label>
            <button
              type="button"
              onClick={() => {
                setAddingCard((prev) => !prev);
                setCardError("");
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
            >
              <Plus className="h-4 w-4" />
              Add term
            </button>
          </div>
        </div>

        {cardError ? (
          <div
            role="alert"
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {cardError}
          </div>
        ) : null}

        {addingCard ? (
          <form
            onSubmit={handleAddInlineCard}
            className="rounded-2xl border border-[#5B6CFA]/50 bg-white p-5 dark:bg-[#141926]"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="new-inline-term" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Term
                </label>
                <input
                  id="new-inline-term"
                  type="text"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="Enter term"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
                />
              </div>
              <div>
                <label htmlFor="new-inline-def" className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Definition
                </label>
                <input
                  id="new-inline-def"
                  type="text"
                  value={newDef}
                  onChange={(e) => setNewDef(e.target.value)}
                  placeholder="Enter definition"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddingCard(false)}
                className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-sm font-medium dark:border-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingCard}
                className="rounded-xl bg-[#494bd2] px-4 py-1.5 text-sm font-semibold text-white hover:bg-[#4B5CE8]"
              >
                {savingCard ? "Adding..." : "Save card"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="space-y-3">
          {detail.cards.map((card) => {
            const isEditing = editingCardId === card.id;
            const definitionVisible = showDefinitions || revealedCardIds.has(card.id);
            return (
              <div
                key={card.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]"
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`edit-term-${card.id}`}
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Term
                        </label>
                        <input
                          id={`edit-term-${card.id}`}
                          type="text"
                          value={editTerm}
                          onChange={(e) => setEditTerm(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`edit-def-${card.id}`}
                          className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400"
                        >
                          Definition
                        </label>
                        <textarea
                          id={`edit-def-${card.id}`}
                          rows={2}
                          value={editDef}
                          onChange={(e) => setEditDef(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingCardId(null)}
                        aria-label="Cancel editing card"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium dark:border-slate-700"
                      >
                        <X className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={savingCard}
                        onClick={() => handleSaveInlineCard(card.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-[#494bd2] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-12 sm:gap-6">
                      <div className={`font-semibold wrap-break-word text-slate-900 dark:text-white ${definitionVisible ? "sm:col-span-4" : "sm:col-span-12"}`}>
                        {showDefinitions ? (
                          <p>{card.term}</p>
                        ) : (
                          <button
                            type="button"
                            aria-expanded={definitionVisible}
                            onClick={() => toggleDefinition(card.id)}
                            onKeyDown={(event) => {
                              // Space activates this row instead of the flashcard viewer's shortcut.
                              if (event.code === "Space") event.stopPropagation();
                            }}
                            className="w-full cursor-pointer text-left underline decoration-dotted underline-offset-4 hover:decoration-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5B6CFA]"
                          >
                            {card.term}
                          </button>
                        )}
                      </div>
                      {definitionVisible ? (
                        <p className="text-sm leading-relaxed wrap-break-word text-slate-600 dark:text-slate-300 sm:col-span-8">
                          {card.definition}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => startEditCard(card)}
                        aria-label={`Edit card "${card.term}"`}
                        className="rounded-lg p-2 text-slate-600 dark:text-slate-400 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-[#1C2336] dark:hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteCardTarget(card)}
                        aria-label={`Delete card "${card.term}"`}
                        className="rounded-lg p-2 text-slate-600 dark:text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={deleteSetOpen}
        title="Delete flashcard set"
        message={`Delete "${detail.set.title}" and all ${detail.cards.length} cards permanently?`}
        confirmLabel="Delete set"
        loading={deleting}
        onCancel={() => setDeleteSetOpen(false)}
        onConfirm={handleDeleteSet}
      />

      <ConfirmDialog
        open={deleteCardTarget !== null}
        title="Delete flashcard"
        message={`Remove "${deleteCardTarget?.term ?? ""}" from this set?`}
        confirmLabel="Delete card"
        loading={deleting}
        onCancel={() => setDeleteCardTarget(null)}
        onConfirm={handleConfirmDeleteCard}
      />
    </div>
  );
}
