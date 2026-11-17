import { useCallback, useEffect, useRef, useState } from "react";
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
  const flipButton = useRef<HTMLButtonElement>(null);

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
      if (event.defaultPrevented) return;
      if (event.key === "Escape" && fullscreen) {
        setFullscreen(false);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (document.querySelector("dialog[open]") ||
          (target !== flipButton.current && target?.closest("input, textarea, select, button, a, summary, [contenteditable=true]"))) {
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
        <p className="text-sm text-slate-600 dark:text-slate-400">
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
          ? "fixed inset-0 z-50 flex flex-col justify-between gap-4 overflow-y-auto bg-slate-50 p-4 sm:p-10 dark:bg-[#0B0E17]"
          : "space-y-4"
      }
    >
      <div className="perspective-1000 mx-auto flex w-full flex-1 flex-col justify-center">
        <button
          ref={flipButton}
          type="button"
          onClick={toggleFlip}
          aria-label={
            flipped
              ? `Definition: ${currentCard.definition}. Click or press Space to flip to term.`
              : `Term: ${currentCard.term}. Click or press Space to flip to definition.`
          }
          className={`relative grid w-full cursor-pointer rounded-3xl border border-slate-200 bg-white text-center shadow-sm transition-transform duration-300 motion-reduce:transition-none preserve-3d focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#1E2538] ${
            fullscreen ? "min-h-[60dvh]" : "min-h-[260px] sm:min-h-[340px]"
          } ${flipped ? "rotate-y-180" : ""}`}
        >
          <div aria-hidden={flipped} className={`flex min-w-0 flex-col items-center justify-center px-4 py-12 backface-hidden sm:px-8 ${flipped ? "absolute inset-0 overflow-hidden" : "relative"}`}>
            <span className="absolute left-4 top-4 text-xs font-medium text-slate-600 sm:left-6 dark:text-slate-400">
              Term
            </span>
            <span className="absolute right-4 top-4 text-xs text-slate-600 sm:right-6 dark:text-slate-400">
              <span className="sm:hidden">Tap to flip</span>
              <span className="hidden sm:inline">Click or Space to flip</span>
            </span>
            <p className="max-w-xl wrap-anywhere text-2xl font-bold leading-snug text-slate-900 dark:text-white sm:text-3xl">
              {currentCard.term}
            </p>
          </div>

          <div aria-hidden={!flipped} className={`flex min-w-0 flex-col items-center justify-center px-4 py-12 backface-hidden rotate-y-180 sm:px-8 ${flipped ? "relative" : "absolute inset-0 overflow-hidden"}`}>
            <span className="absolute left-4 top-4 text-xs font-medium text-teal-700 sm:left-6 dark:text-teal-300">
              Definition
            </span>
            <span className="absolute right-4 top-4 text-xs text-slate-600 sm:right-6 dark:text-slate-400">
              <span className="sm:hidden">Tap to flip</span>
              <span className="hidden sm:inline">Click or Space to flip</span>
            </span>
            <p className="max-w-xl wrap-anywhere text-lg leading-relaxed text-slate-700 dark:text-slate-100 sm:text-xl">
              {currentCard.definition}
            </p>
          </div>
        </button>
      </div>

      <div className="mx-auto flex w-full items-center justify-between gap-1 sm:gap-4">
        <button
          type="button"
          onClick={handleReset}
          aria-label="Restart deck from first card"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-sm font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-100 sm:px-3.5 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Restart</span>
        </button>

        <div className="flex items-center gap-1 sm:gap-3">
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
            className="min-w-12 whitespace-nowrap text-center font-mono-nums text-xs font-semibold text-slate-700 sm:min-w-18 sm:text-sm dark:text-slate-200"
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
