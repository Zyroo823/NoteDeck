import { useEffect, useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { updateGuideSchema, type StudyGuideConcept } from "@/src/lib/schemas";
import { SafeMarkdownText } from "@/src/components/SafeMarkdownText";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import type { StudyGuideDetail } from "@/src/types/api";

interface StudyGuideViewProps {
  guideId: string;
  onNavigate: (path: string) => void;
}

export function StudyGuideView({ guideId, onNavigate }: StudyGuideViewProps) {
  const [guide, setGuide] = useState<StudyGuideDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [concepts, setConcepts] = useState<StudyGuideConcept[]>([]);
  const [termsText, setTermsText] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadGuide() {
      setLoading(true);
      setErrorMessage("");
      try {
        const res = await fetch(`/api/guides/${guideId}`);
        const data = (await res.json()) as { guide?: StudyGuideDetail; error?: string };
        if (!res.ok || !data.guide) {
          if (active) setErrorMessage(data.error ?? "Study guide not found.");
          return;
        }
        if (active) {
          setGuide(data.guide);
          setTitle(data.guide.title);
          setSummary(data.guide.content.summary);
          setConcepts(data.guide.content.key_concepts);
          setTermsText(data.guide.content.important_terms.join(", "));
        }
      } catch {
        if (active) setErrorMessage("Network error while loading study guide.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadGuide();
    return () => {
      active = false;
    };
  }, [guideId]);

  async function handleSave() {
    setErrorMessage("");
    const parsedTerms = termsText
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const parsed = updateGuideSchema.safeParse({
      title,
      content: {
        summary,
        key_concepts: concepts.map((kc) => ({
          heading: kc.heading,
          bullets: kc.bullets.filter((b) => b.trim().length > 0),
        })),
        important_terms: parsedTerms,
      },
    });

    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Check your study guide fields.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/guides/${guideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { guide?: StudyGuideDetail; error?: string };
      if (!res.ok || !data.guide) {
        setErrorMessage(data.error ?? "Failed to update study guide.");
        return;
      }
      setGuide(data.guide);
      setEditing(false);
    } catch {
      setErrorMessage("Network error while saving study guide.");
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/guides/${guideId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setErrorMessage(data.error ?? "Failed to delete study guide.");
        return;
      }
      onNavigate("/library?type=guides");
    } catch {
      setErrorMessage("Network error while deleting study guide.");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="h-12 w-72 animate-pulse rounded-xl bg-slate-200 dark:bg-[#141926]" />
        <div className="h-44 animate-pulse rounded-2xl bg-slate-200 dark:bg-[#141926]" />
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/40">
        <p className="text-sm font-medium text-red-700 dark:text-red-300">
          {errorMessage || "Study guide not found."}
        </p>
        <button
          type="button"
          onClick={() => onNavigate("/library")}
          className="mt-4 rounded-xl bg-[#5B6CFA] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Your library
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#2DD4BF]">Study guide</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            {guide.title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {guide.setId ? (
            <button
              type="button"
              onClick={() => onNavigate(`/sets/${guide.setId}`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
            >
              <Layers className="h-4 w-4 text-[#5B6CFA]" />
              Practice flashcards
            </button>
          ) : null}

          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:hover:bg-[#1C2336]"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-300 px-3.5 text-sm font-medium text-red-600 whitespace-nowrap transition hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {errorMessage}
        </div>
      ) : null}

      {editing ? (
        <div className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
          <div>
            <label htmlFor="guide-edit-title" className="mb-1.5 block text-sm font-semibold">
              Title
            </label>
            <input
              id="guide-edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
            />
          </div>

          <div>
            <label htmlFor="guide-edit-summary" className="mb-1.5 block text-sm font-semibold">
              Summary
            </label>
            <textarea
              id="guide-edit-summary"
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Key concepts</span>
              <button
                type="button"
                onClick={() =>
                  setConcepts((prev) => [...prev, { heading: "New section", bullets: [""] }])
                }
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium dark:border-slate-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add section
              </button>
            </div>

            {concepts.map((concept, cIdx) => (
              <div
                key={cIdx}
                className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    aria-label={`Concept heading ${cIdx + 1}`}
                    value={concept.heading}
                    onChange={(e) =>
                      setConcepts((prev) =>
                        prev.map((item, i) =>
                          i === cIdx ? { ...item, heading: e.target.value } : item
                        )
                      )
                    }
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold dark:border-slate-700 dark:bg-[#0B0E17]"
                  />
                  {concepts.length > 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setConcepts((prev) => prev.filter((_, i) => i !== cIdx))
                      }
                      aria-label={`Remove concept section ${cIdx + 1}`}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div>
                  <label
                    htmlFor={`concept-bullets-${cIdx}`}
                    className="mb-1 block text-xs text-slate-500"
                  >
                    Bullet points (one per line)
                  </label>
                  <textarea
                    id={`concept-bullets-${cIdx}`}
                    rows={3}
                    value={concept.bullets.join("\n")}
                    onChange={(e) =>
                      setConcepts((prev) =>
                        prev.map((item, i) =>
                          i === cIdx ? { ...item, bullets: e.target.value.split("\n") } : item
                        )
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label htmlFor="guide-edit-terms" className="mb-1.5 block text-sm font-semibold">
              Important terms (comma separated)
            </label>
            <input
              id="guide-edit-terms"
              type="text"
              value={termsText}
              onChange={(e) => setTermsText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0B0E17]"
            />
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium dark:border-slate-700"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl bg-[#5B6CFA] px-5 py-2 text-sm font-semibold text-white hover:bg-[#4B5CE8]"
            >
              {saving ? "Saving..." : "Save guide"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Summary</h2>
            <p className="mt-2.5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <SafeMarkdownText text={guide.content.summary} />
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Key concepts</h2>
            <div className="space-y-4">
              {guide.content.key_concepts.map((concept, idx) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]"
                >
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {concept.heading}
                  </h3>
                  <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {concept.bullets.map((bullet, bIdx) => (
                      <li key={bIdx}>
                        <SafeMarkdownText text={bullet} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {guide.content.important_terms.length > 0 ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Important terms
              </h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {guide.content.important_terms.map((term, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800 dark:border-slate-800 dark:bg-[#0B0E17] dark:text-slate-200"
                  >
                    {term}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        title="Delete study guide"
        message={`Delete "${guide.title}" permanently?`}
        confirmLabel="Delete guide"
        loading={deleting}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
