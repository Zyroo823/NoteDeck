import { useMemo, useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import {
  buildQuizQuestions,
  gradeQuiz,
  type QuizGradeSummary,
  type StudyCardItem,
} from "@/src/lib/studyLogic";

interface TestModeProps {
  setId: string;
  cards: StudyCardItem[];
  onAttemptSaved: () => void;
}

export function TestMode({ setId, cards, onAttemptSaved }: TestModeProps) {
  const [attemptSeed, setAttemptSeed] = useState(0);
  const questions = useMemo(() => buildQuizQuestions(cards), [cards, attemptSeed]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<QuizGradeSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#141926]">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add flashcards to this set before starting a multiple-choice test.
        </p>
      </div>
    );
  }

  function selectOption(cardId: string, option: string) {
    if (summary) return;
    setSelections((prev) => ({ ...prev, [cardId]: option }));
  }

  async function handleSubmitQuiz() {
    const result = gradeQuiz(questions, selections);
    setSummary(result);
    setSubmitting(true);
    setSaveError("");
    try {
      const res = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setId,
          score: result.score,
          total: result.total,
        }),
      });
      if (!res.ok) {
        setSaveError("Score calculated, but could not save attempt history.");
        return;
      }
      onAttemptSaved();
    } catch {
      setSaveError("Network error while saving your quiz score.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleRetake() {
    setSelections({});
    setSummary(null);
    setSaveError("");
    setAttemptSeed((prev) => prev + 1);
  }

  const answeredCount = Object.keys(selections).length;
  const allAnswered = answeredCount === questions.length;

  if (summary) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Test complete
              </p>
              <h2 className="mt-1 font-mono-nums text-3xl font-bold text-slate-900 dark:text-white">
                {summary.percentage}%{" "}
                <span className="text-base font-medium text-slate-500 dark:text-slate-400">
                  ({summary.score} of {summary.total} correct)
                </span>
              </h2>
            </div>

            <button
              type="button"
              onClick={handleRetake}
              className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8]"
            >
              <RotateCcw className="h-4 w-4" />
              Retake test
            </button>
          </div>

          {saveError ? (
            <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">{saveError}</p>
          ) : submitting ? (
            <p className="mt-3 text-xs text-slate-500">Saving attempt...</p>
          ) : (
            <p className="mt-3 text-xs text-[#2DD4BF]">Quiz attempt saved to your progress.</p>
          )}
        </div>

        <div className="space-y-3">
          {summary.results.map((item, idx) => (
            <div
              key={item.cardId}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono-nums text-xs font-medium text-slate-500">
                    Question {idx + 1}
                  </span>
                  <h3 className="mt-0.5 text-base font-bold text-slate-900 dark:text-white">
                    {item.prompt}
                  </h3>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
                    item.isCorrect
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {item.isCorrect ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Correct
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      Incorrect
                    </>
                  )}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-sm">
                {!item.isCorrect ? (
                  <p className="text-red-600 dark:text-red-400">
                    Your answer: {item.selected || "Not answered"}
                  </p>
                ) : null}
                <p className="text-emerald-700 dark:text-emerald-300">
                  Correct answer: {item.correctAnswer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#141926]">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          Choose the matching definition for each term
        </span>
        <span className="font-mono-nums text-sm font-semibold text-[#494bd2] dark:text-[#a5b4fc]">
          {answeredCount} / {questions.length} answered
        </span>
      </div>

      <div className="space-y-4">
        {questions.map((question, qIdx) => (
          <fieldset
            key={question.cardId}
            className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]"
          >
            <legend className="sr-only">
              Question {qIdx + 1}: {question.prompt}
            </legend>
            <p className="font-mono-nums text-xs font-medium text-slate-500">
              Question {qIdx + 1} of {questions.length}
            </p>
            <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
              {question.prompt}
            </h3>

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {question.options.map((option) => {
                const selected = selections[question.cardId] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectOption(question.cardId, option)}
                    aria-pressed={selected}
                    className={`rounded-xl border p-3.5 text-left text-sm leading-snug transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] ${
                      selected
                        ? "border-[#5B6CFA] bg-[#5B6CFA]/15 font-medium text-slate-900 dark:text-white"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-400 dark:border-slate-800 dark:bg-[#0B0E17] dark:text-slate-200 dark:hover:border-slate-600"
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmitQuiz}
          disabled={!allAnswered}
          className="rounded-xl bg-[#494bd2] px-6 py-3 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Submit test ({answeredCount}/{questions.length})
        </button>
      </div>
    </div>
  );
}
