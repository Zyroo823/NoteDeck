import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Maximize2, Minimize2, RotateCcw, Shuffle } from "lucide-react";
import { shuffleCards, type StudyCardItem } from "@/src/lib/studyLogic";

interface FlashcardViewerProps {
  cards: StudyCardItem[];
}

export function FlashcardViewer({ cards }: FlashcardViewerProps) {
  const [deck, setDeck] = useState<StudyCardItem[]>(cards);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    setDeck(cards);
    setIndex(0);
    setFlipped(false);
    setShuffled(false);
  }, [cards]);

  const goPrev = useCallback(() => {
    setFlipped(false);
    setIndex((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const goNext = useCallback(() => {
    setFlipped(false);
    setIndex((prev) => (prev < deck.length - 1 ? prev + 1 : prev));
  }, [deck.length]);

  const toggleFlip = useCallback(() => {
    setFlipped((prev) => !prev);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") {
        return;
      }
      if (event.code === "Space") {
        event.preventDefault();
        toggleFlip();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        goPrev();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        goNext();
      } else if (event.key === "Escape" && fullscreen) {
        setFullscreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFlip, goPrev, goNext, fullscreen]);

  function handleShuffle() {
    setFlipped(false);
    setIndex(0);
    if (shuffled) {
      setDeck(cards);
      setShuffled(false);
    } else {
      setDeck(shuffleCards(cards));
      setShuffled(true);
    }
  }

  function handleReset() {
    setFlipped(false);
    setIndex(0);
  }

  if (deck.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-800 dark:bg-[#141926]">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add at least one card below to practice in Flashcard mode.
        </p>
      </div>
    );
  }

  const currentCard = deck[Math.min(index, deck.length - 1)];

  const viewerContent = (
    <div
      className={
        fullscreen
          ? "fixed inset-0 z-50 flex flex-col justify-between bg-slate-50 p-6 dark:bg-[#0B0E17] sm:p-10"
          : "space-y-4"
      }
    >
      <div className="perspective-1000 mx-auto w-full max-w-3xl flex-1 flex flex-col justify-center">
        <button
          type="button"
          onClick={toggleFlip}
          aria-label={
            flipped
              ? `Definition: ${currentCard.definition}. Click or press Space to flip to term.`
              : `Term: ${currentCard.term}. Click or press Space to flip to definition.`
          }
          className={`group relative w-full cursor-pointer rounded-3xl border border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 preserve-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#1E2538] ${
            fullscreen ? "min-h-[60vh]" : "min-h-[340px]"
          } ${flipped ? "rotate-y-180" : ""}`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden">
            <span className="absolute left-6 top-5 text-xs font-medium text-slate-500">
              Term
            </span>
            <span className="absolute right-6 top-5 text-xs text-slate-500">
              Click or Space to flip
            </span>
            <p className="max-w-xl text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">
              {currentCard.term}
            </p>
          </div>

          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 backface-hidden rotate-y-180">
            <span className="absolute left-6 top-5 text-xs font-medium text-[#2DD4BF]">
              Definition
            </span>
            <span className="absolute right-6 top-5 text-xs text-slate-500">
              Click or Space to flip
            </span>
            <p className="max-w-xl text-lg leading-relaxed text-slate-700 dark:text-slate-100 sm:text-xl">
              {currentCard.definition}
            </p>
          </div>
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <button
          type="button"
          onClick={handleReset}
          aria-label="Restart deck from first card"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Restart</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0}
            aria-label="Previous card"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100 dark:hover:bg-[#1C2336]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <span
            data-testid="flashcard-progress"
            className="min-w-[4.5rem] text-center font-mono-nums text-sm font-semibold text-slate-700 dark:text-slate-200"
          >
            {index + 1} / {deck.length}
          </span>

          <button
            type="button"
            onClick={goNext}
            disabled={index >= deck.length - 1}
            aria-label="Next card"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100 dark:hover:bg-[#1C2336]"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShuffle}
            aria-label={shuffled ? "Restore original card order" : "Shuffle flashcards"}
            aria-pressed={shuffled}
            className={`flex h-10 w-10 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] ${
              shuffled
                ? "border-[#5B6CFA] bg-[#5B6CFA]/15 text-[#5B6CFA]"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
            }`}
          >
            <Shuffle className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setFullscreen((prev) => !prev)}
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );

  return viewerContent;
}
