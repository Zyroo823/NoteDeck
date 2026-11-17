import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileText, Layers, Loader2, Trash2, UploadCloud, X } from "lucide-react";
import { pastedTextSchema, type AiGenerationOutput } from "@/src/lib/schemas";
import { validateUploadFiles } from "@/src/lib/studyLogic";

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (setId: string) => void;
}

type InputTab = "paste" | "upload" | "gdrive" | "record";

export function GenerateModal({ open, onClose, onSaved }: GenerateModalProps) {
  const [tab, setTab] = useState<InputTab>("upload");
  const [pastedText, setPastedText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Job polling state
  const [jobId, setJobId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [stepMessage, setStepMessage] = useState("");

  // Editable preview state before saving
  const [preview, setPreview] = useState<AiGenerationOutput | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape" && !generating && !saving) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, generating, saving, onClose]);

  useEffect(() => {
    if (!jobId || !generating) return;

    const timer = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/generate/${jobId}`);
        const data = (await res.json()) as {
          job?: {
            status: "pending" | "processing" | "done" | "failed";
            stepMessage: string;
            previewResult: AiGenerationOutput | null;
            error: string | null;
          };
          error?: string;
        };
        if (!res.ok || !data.job) {
          setErrorMessage(data.error ?? "Could not check generation progress.");
          setGenerating(false);
          return;
        }
        setStepMessage(data.job.stepMessage);
        if (data.job.status === "done" && data.job.previewResult) {
          setPreview(data.job.previewResult);
          setGenerating(false);
        } else if (data.job.status === "failed") {
          setErrorMessage(data.job.error ?? "Generation failed. Try different material.");
          setGenerating(false);
        }
      } catch {
        setErrorMessage("Lost connection while checking generation progress.");
        setGenerating(false);
      }
    }, 900);

    return () => window.clearInterval(timer);
  }, [jobId, generating]);

  if (!open) return null;

  function handleAddFiles(candidateList: FileList | null) {
    if (!candidateList) return;
    setErrorMessage("");
    const merged = [...files, ...Array.from(candidateList)].slice(0, 2);
    const check = validateUploadFiles(
      merged.map((f) => ({ name: f.name, type: f.type, size: f.size }))
    );
    if (!check.valid) {
      setErrorMessage(check.error ?? "Invalid file selection.");
      return;
    }
    setFiles(merged);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleAddFiles(event.dataTransfer.files);
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    handleAddFiles(event.target.files);
    event.target.value = "";
  }

  const pasteValid = pastedTextSchema.safeParse({ text: pastedText }).success;
  const uploadValid =
    files.length > 0 &&
    validateUploadFiles(files.map((f) => ({ name: f.name, type: f.type, size: f.size }))).valid;
  const canGenerate =
    !generating && ((tab === "paste" && pasteValid) || (tab === "upload" && uploadValid));

  async function handleGenerate() {
    setErrorMessage("");
    setPreview(null);
    setGenerating(true);
    setStepMessage(tab === "upload" ? "Uploading your file..." : "Reading your notes...");

    try {
      let res: Response;
      if (tab === "upload") {
        const formData = new FormData();
        for (const f of files) {
          formData.append("files", f);
        }
        res = await fetch("/api/generate", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: pastedText }),
        });
      }

      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !data.jobId) {
        setErrorMessage(data.error ?? "Could not start generation.");
        setGenerating(false);
        return;
      }
      setJobId(data.jobId);
    } catch {
      setErrorMessage("Network error while starting generation.");
      setGenerating(false);
    }
  }

  async function handleSavePreview() {
    if (!preview || !jobId) return;
    setErrorMessage("");
    setSaving(true);
    try {
      const res = await fetch(`/api/generate/${jobId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data = (await res.json()) as { setId?: string; error?: string };
      if (!res.ok || !data.setId) {
        setErrorMessage(data.error ?? "Could not save generated study material.");
        return;
      }
      setPreview(null);
      setJobId(null);
      setPastedText("");
      setFiles([]);
      onSaved(data.setId);
    } catch {
      setErrorMessage("Network error while saving study material.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="generate-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#0B0E17]">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B6CFA]/15 text-[#5B6CFA]">
              <FileText className="h-4 w-4" />
            </span>
            <h2 id="generate-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Generate Study Guides
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={generating || saving}
            aria-label="Close Generate Study Guides dialog"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-[#1C2336]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {errorMessage ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {errorMessage}
            </div>
          ) : null}

          {generating ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-[#5B6CFA]" />
              <p className="mt-4 text-base font-semibold text-slate-900 dark:text-white">
                {stepMessage || "Generating study materials..."}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Building flashcards and study guide strictly from your source material.
              </p>
            </div>
          ) : preview ? (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold">Preview and edit before saving</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Adjust the title, flashcards, or study guide summary before saving to your library.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setJobId(null);
                  }}
                  className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-semibold dark:border-slate-700"
                >
                  Start over
                </button>
              </div>

              <div>
                <label htmlFor="preview-title" className="mb-1.5 block text-sm font-semibold">
                  Set &amp; guide title
                </label>
                <input
                  id="preview-title"
                  type="text"
                  value={preview.title}
                  onChange={(e) => setPreview({ ...preview, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-[#141926]"
                />
              </div>

              <div>
                <label htmlFor="preview-summary" className="mb-1.5 block text-sm font-semibold">
                  Study guide summary
                </label>
                <textarea
                  id="preview-summary"
                  rows={3}
                  value={preview.study_guide.summary}
                  onChange={(e) =>
                    setPreview({
                      ...preview,
                      study_guide: { ...preview.study_guide, summary: e.target.value },
                    })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-[#141926]"
                />
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-semibold">
                  Generated flashcards (<span className="font-mono-nums">{preview.cards.length}</span>)
                </h4>
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {preview.cards.map((card, idx) => (
                    <div
                      key={idx}
                      className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-[#141926] sm:grid-cols-12"
                    >
                      <input
                        type="text"
                        aria-label={`Generated term ${idx + 1}`}
                        value={card.term}
                        onChange={(e) =>
                          setPreview({
                            ...preview,
                            cards: preview.cards.map((item, i) =>
                              i === idx ? { ...item, term: e.target.value } : item
                            ),
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium dark:border-slate-700 dark:bg-[#0B0E17] sm:col-span-4"
                      />
                      <input
                        type="text"
                        aria-label={`Generated definition ${idx + 1}`}
                        value={card.definition}
                        onChange={(e) =>
                          setPreview({
                            ...preview,
                            cards: preview.cards.map((item, i) =>
                              i === idx ? { ...item, definition: e.target.value } : item
                            ),
                          })
                        }
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-[#0B0E17] sm:col-span-7"
                      />
                      <button
                        type="button"
                        disabled={preview.cards.length <= 1}
                        onClick={() =>
                          setPreview({
                            ...preview,
                            cards: preview.cards.filter((_, i) => i !== idx),
                          })
                        }
                        aria-label={`Remove generated card ${idx + 1}`}
                        className="flex items-center justify-center rounded-lg p-1.5 text-slate-500 hover:text-red-500 disabled:opacity-30 sm:col-span-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="flex flex-wrap gap-6 border-b border-slate-200 dark:border-slate-800" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "paste"}
                  onClick={() => {
                    setTab("paste");
                    setErrorMessage("");
                  }}
                  className={`border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition ${
                    tab === "paste"
                      ? "border-[#5B6CFA] text-slate-900 dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Paste text
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "upload"}
                  onClick={() => {
                    setTab("upload");
                    setErrorMessage("");
                  }}
                  className={`border-b-2 pb-3 text-sm font-semibold whitespace-nowrap transition ${
                    tab === "upload"
                      ? "border-[#5B6CFA] text-slate-900 dark:text-white"
                      : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  Upload files
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "gdrive"}
                  onClick={() => setTab("gdrive")}
                  className={`border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition ${
                    tab === "gdrive"
                      ? "border-[#5B6CFA] text-slate-900 dark:text-white"
                      : "border-transparent text-slate-500"
                  }`}
                >
                  Google Drive <span className="ml-1 text-xs">(Coming soon)</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "record"}
                  onClick={() => setTab("record")}
                  className={`border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition ${
                    tab === "record"
                      ? "border-[#5B6CFA] text-slate-900 dark:text-white"
                      : "border-transparent text-slate-500"
                  }`}
                >
                  Record lecture <span className="ml-1 text-xs">(Coming soon)</span>
                </button>
              </div>

              {tab === "paste" ? (
                <div>
                  <label htmlFor="paste-notes-area" className="sr-only">
                    Paste your lecture notes or textbook excerpt
                  </label>
                  <textarea
                    id="paste-notes-area"
                    rows={8}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Paste your lecture notes, reading excerpt, or outline here (at least 30 characters)..."
                    className="w-full rounded-2xl border border-slate-300 bg-white p-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#141926] dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Minimum 30 characters</span>
                    <span className="font-mono-nums">{pastedText.length} / 50,000</span>
                  </div>
                </div>
              ) : tab === "upload" ? (
                <div className="space-y-4">
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition ${
                      dragging
                        ? "border-[#5B6CFA] bg-[#5B6CFA]/10"
                        : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-[#141926]"
                    }`}
                  >
                    <UploadCloud className="h-10 w-10 text-[#5B6CFA]" />
                    <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                      Drag and drop notes, readings, lecture slides, etc.
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      Upload up to 2 PDFs or PowerPoint files, each up to 25 MB and 80 pages or slides.
                    </p>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.pptx"
                      multiple
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-5 rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-[#1C2336] dark:text-white dark:hover:bg-slate-700"
                    >
                      Browse files
                    </button>
                  </div>

                  {files.length > 0 ? (
                    <div className="space-y-2">
                      {files.map((file, idx) => (
                        <div
                          key={`${file.name}-${idx}`}
                          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm dark:border-slate-800 dark:bg-[#141926]"
                        >
                          <span className="truncate font-medium">{file.name}</span>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-mono-nums text-xs text-slate-500">
                              {(file.size / 1024).toFixed(0)} KB
                            </span>
                            <button
                              type="button"
                              onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                              aria-label={`Remove ${file.name}`}
                              className="text-slate-500 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center dark:border-slate-800 dark:bg-[#141926]">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {tab === "gdrive" ? "Google Drive import" : "Lecture audio recording"} is not available yet.
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Switch to Paste text or Upload files to generate flashcards and a study guide now.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">What you&apos;ll get</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#141926]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#5B6CFA]/15 text-[#5B6CFA]">
                      <Layers className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Flashcards</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Memorize key terms &amp; definitions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-[#141926]">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#2DD4BF]/15 text-[#2DD4BF]">
                      <FileText className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">Study guide</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Summary, concepts &amp; key terms
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            AI may provide incorrect content. Do not enter personal data.
          </p>

          {preview ? (
            <button
              type="button"
              onClick={handleSavePreview}
              disabled={saving}
              className="rounded-full bg-[#494bd2] px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save to Library"}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!canGenerate}
              className="rounded-full bg-[#494bd2] px-6 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
