import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
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
  const [questionIndex, setQuestionIndex] = useState(0);
  const [summary, setSummary] = useState<QuizGradeSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);

  useEffect(() => {
    if (focusHeading.current) {
      headingRef.current?.focus();
      focusHeading.current = false;
    }
  }, [questionIndex, summary, attemptSeed]);

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#141926]">
        <p className="text-sm text-slate-600 dark:text-slate-400">
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
    focusHeading.current = true;
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
    focusHeading.current = true;
    setQuestionIndex(0);
    setSelections({});
    setSummary(null);
    setSaveError("");
    setAttemptSeed((prev) => prev + 1);
  }

  const answeredCount = Object.keys(selections).length;
  const allAnswered = answeredCount === questions.length;

  function goToQuestion(index: number) {
    focusHeading.current = true;
    setQuestionIndex(index);
  }

  if (summary) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 ref={headingRef} tabIndex={-1} className="text-sm font-medium text-slate-600 dark:text-slate-400">
                Test complete
              </h2>
              <p className="mt-1 font-mono-nums text-3xl font-bold text-slate-900 dark:text-white">
                {summary.percentage}%{" "}
                <span className="text-base font-medium text-slate-600 dark:text-slate-400">
                  ({summary.score} of {summary.total} correct)
                </span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleRetake}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white whitespace-nowrap transition hover:bg-[#4B5CE8] disabled:opacity-60"
            >
              <RotateCcw className="h-4 w-4" />
              Retake test
            </button>
          </div>

          {saveError ? (
            <p role="alert" className="mt-3 text-xs text-amber-800 dark:text-amber-400">{saveError}</p>
          ) : submitting ? (
            <p role="status" className="mt-3 text-xs text-slate-600 dark:text-slate-400">Saving attempt…</p>
          ) : (
            <p role="status" className="mt-3 text-xs text-teal-700 dark:text-teal-300">Quiz attempt saved to your progress.</p>
          )}
        </div>

        <div className="space-y-3">
          {summary.results.map((item, idx) => (
            <div
              key={item.cardId}
              className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="font-mono-nums text-xs font-medium text-slate-600 dark:text-slate-400">
                    Question {idx + 1}
                  </span>
                  <h3 className="mt-0.5 wrap-anywhere text-base font-bold text-slate-900 dark:text-white">
                    {item.prompt}
                  </h3>
                </div>

                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
                    item.isCorrect
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-700 dark:text-red-400"
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

              <div className="mt-3 space-y-1.5 wrap-anywhere text-sm">
                {!item.isCorrect ? (
                  <p className="text-red-700 dark:text-red-400">
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

  const question = questions[questionIndex];
  const lastQuestion = questionIndex === questions.length - 1;

  return (
    <section aria-label="Multiple-choice test" className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-[#141926]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-medium text-slate-600 dark:text-slate-400">
        <span className="font-mono-nums">Question {questionIndex + 1} of {questions.length}</span>
        <span className="font-mono-nums">{answeredCount} / {questions.length} answered</span>
      </div>
      <progress value={answeredCount} max={questions.length} aria-label="Questions answered" className="quiz-progress mt-2.5 block h-1.5 w-full overflow-hidden rounded-full" />

      <fieldset className="mt-5 min-w-0">
        <legend className="sr-only">Question {questionIndex + 1}: {question.prompt}</legend>
        <h2 ref={headingRef} tabIndex={-1} className="wrap-anywhere text-xl font-bold">
          {question.prompt}
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Choose the matching definition.</p>
        <div className="mt-4 grid gap-2">
          {question.options.map((option, index) => {
            const selected = selections[question.cardId] === option;
            return (
              <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-indigo-600 dark:[&:has(:focus-visible)]:outline-indigo-300 ${
                selected
                  ? "border-indigo-500 bg-indigo-50 font-medium dark:border-indigo-400 dark:bg-indigo-500/15"
                  : "border-slate-300 bg-slate-50 hover:border-slate-500 dark:border-slate-700 dark:bg-[#0B0E17] dark:hover:border-slate-400"
              }`}>
                <input type="radio" name={`quiz-${question.cardId}`} className="sr-only"
                  checked={selected} onChange={() => selectOption(question.cardId, option)} />
                <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-md border font-mono-nums text-xs font-semibold ${
                  selected ? "border-transparent bg-[#494bd2] text-white" : "border-slate-300 text-slate-600 dark:border-slate-600 dark:text-slate-400"
                }`}>{String.fromCharCode(65 + index)}</span>
                <span className="min-w-0 flex-1 wrap-anywhere">{option}</span>
                {selected && <Check aria-hidden="true" data-selected-answer className="size-4 shrink-0 text-indigo-700 dark:text-indigo-300" />}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-5 flex justify-between gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <button type="button" onClick={() => goToQuestion(questionIndex - 1)} disabled={questionIndex === 0}
          className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-700 dark:hover:bg-[#1C2336]">
          Back
        </button>
        <button type="button"
          onClick={lastQuestion ? handleSubmitQuiz : () => goToQuestion(questionIndex + 1)}
          disabled={lastQuestion ? !allAnswered : !selections[question.cardId]}
          className="min-h-11 rounded-xl bg-[#494bd2] px-4 text-sm font-semibold text-white transition hover:bg-[#4B5CE8] disabled:cursor-not-allowed disabled:opacity-55">
          {lastQuestion ? "Submit test" : "Next question"}
        </button>
      </div>
    </section>
  );
}
