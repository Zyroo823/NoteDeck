import { useState } from "react";
import { ArrowDown, ArrowRight, Moon, RotateCcw, Sun } from "lucide-react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4547cd] dark:focus-visible:outline-indigo-300";
const primaryLink = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#494bd2] px-5 py-3 font-bold text-white transition-colors hover:bg-[#3739aa] ${focus}`;
const quizOptions = ["Chloroplasts", "Mitochondria", "Ribosomes"];

function FlashcardSample() {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" aria-pressed={flipped} onClick={() => setFlipped((value) => !value)}
      className={`flex min-h-40 w-full flex-col items-center justify-center gap-3 rounded-xl border border-[#d4c8f1] bg-white px-4 py-5 text-center shadow-[0_4px_0_#d4c8f1] transition-colors hover:bg-[#fdfaff] dark:border-indigo-400/25 dark:bg-[#0B0E17] dark:shadow-[0_4px_0_#282542] dark:hover:bg-[#181b30] ${focus}`}>
      <span className="text-xs font-bold text-[#585075] dark:text-indigo-200">{flipped ? "Definition" : "Biology · Sample card"}</span>
      <span aria-live="polite" className={flipped ? "text-base leading-snug font-bold" : "text-xl font-extrabold"}>
        {flipped ? "How plants use light to make sugar from water and carbon dioxide." : "Photosynthesis"}
      </span>
      <span className="flex items-center gap-1.5 text-xs font-semibold text-[#585075] dark:text-indigo-200">
        <RotateCcw aria-hidden="true" className="size-3.5" /> {flipped ? "Show term" : "Flip card"}
      </span>
    </button>
  );
}

function QuizSample() {
  const [answer, setAnswer] = useState<string | null>(null);
  return (
    <div className="min-h-40 rounded-xl border border-[#efcca8] bg-white p-4 dark:border-amber-300/20 dark:bg-[#0B0E17]">
      <p className="text-sm font-bold">Where does photosynthesis happen?</p>
      <div className="mt-2.5 flex flex-wrap gap-2" role="group" aria-label="Sample quiz answers">
        {quizOptions.map((option) => (
          <button key={option} type="button" aria-pressed={answer === option} onClick={() => setAnswer(option)}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors ${focus} ${
              answer === option
                ? option === quizOptions[0]
                  ? "border-[#357953] bg-[#dff3e8] dark:border-emerald-500/60 dark:bg-emerald-950 dark:text-emerald-200"
                  : "border-[#aa573e] bg-[#fce4db] dark:border-red-400/60 dark:bg-red-950 dark:text-red-200"
                : "border-[#dfd5cb] hover:bg-[#fff5e9] dark:border-slate-700 dark:hover:bg-[#1C2336]"
            }`}>
            {option}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 text-xs font-medium text-[#5f4e42] dark:text-amber-100/85">
        {answer === null ? "Pick an answer" : answer === quizOptions[0] ? "Correct. Chloroplasts capture light." : "Try another answer."}
      </p>
    </div>
  );
}

interface LandingPageProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function LandingPage({ theme, onToggleTheme }: LandingPageProps) {
  const themeAction = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg">
        Skip to content
      </a>
      <header className="border-b border-slate-200 dark:border-slate-800">
        <nav aria-label="Main navigation" className="mx-auto flex min-h-17 max-w-7xl items-center gap-2 px-3 sm:gap-8 sm:px-8">
          <a href="/" className={`flex items-center gap-2.5 rounded-md text-lg font-extrabold tracking-tight ${focus}`}>
            <img src="/favicon.svg" width="32" height="32" alt="" />
            NoteDeck
          </a>
          <a href="#study-tools" className={`hidden rounded-md text-sm font-semibold text-slate-600 hover:text-[#3739aa] sm:inline dark:text-slate-300 dark:hover:text-indigo-200 ${focus}`}>Study tools</a>
          <div className="ml-auto flex items-center gap-2 whitespace-nowrap sm:gap-5">
            <button type="button" onClick={onToggleTheme} aria-label={themeAction} title={themeAction}
              className={`grid size-10 shrink-0 place-items-center rounded-lg text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-[#1C2336] ${focus}`}>
              {theme === "dark" ? <Sun aria-hidden="true" className="size-5" /> : <Moon aria-hidden="true" className="size-5" />}
            </button>
            <a href="/login" className={`rounded-md text-sm font-bold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Log in</a>
            <a href="/signup" className={`${primaryLink} max-sm:px-3 text-sm`}>Sign up</a>
          </div>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 sm:px-8 focus-visible:outline-none">
        <section aria-labelledby="landing-title" className="mx-auto flex max-w-3xl flex-col items-center pb-12 pt-14 text-center sm:pb-16 sm:pt-20">
          <h1 id="landing-title" className="text-[clamp(2.6rem,7vw,4.5rem)] leading-[1.05] font-extrabold tracking-[-0.065em]">
            Turn your notes into<br className="hidden sm:block" /> better study sessions.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-400">
            Start with your class notes or slides. Make flashcards, review the key ideas, and quiz yourself before the exam.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <a href="/signup" className={primaryLink}>Get started <ArrowRight aria-hidden="true" className="size-4" /></a>
            <a href="#study-tools" className={`inline-flex items-center gap-1.5 rounded-md py-2 text-sm font-bold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Try the samples <ArrowDown aria-hidden="true" className="size-4" /></a>
          </div>
        </section>

        <section id="study-tools" aria-labelledby="study-tools-heading" className="scroll-mt-6 pb-14">
          <h2 id="study-tools-heading" className="mb-3 text-lg font-extrabold tracking-tight">Study tools</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="flex flex-col rounded-2xl bg-[#eee6fb] p-5 sm:p-6 dark:bg-[#1c1930]">
              <h3 className="text-xl font-extrabold tracking-tight">Flashcards</h3>
              <p className="mb-5 mt-1 text-sm text-[#514768] dark:text-indigo-200">Recall a term, then flip to check it.</p>
              <FlashcardSample />
            </article>
            <article className="flex flex-col rounded-2xl bg-[#e2efeb] p-5 sm:p-6 dark:bg-[#132624]">
              <h3 className="text-xl font-extrabold tracking-tight">Study guides</h3>
              <p className="mb-5 mt-1 text-sm text-[#415954] dark:text-teal-100/85">Review the main ideas from your material.</p>
              <div className="min-h-40 rounded-xl border border-[#bfd6cb] bg-white p-4 dark:border-teal-300/20 dark:bg-[#0B0E17]">
                <p className="text-xs font-bold text-[#486760] dark:text-teal-200">Biology · Sample guide</p>
                <p className="mb-2 mt-1 text-base font-extrabold">How plants make food</p>
                <ul className="list-disc space-y-1 pl-4 text-sm leading-snug text-[#455750] dark:text-slate-300">
                  <li>Chlorophyll absorbs light.</li>
                  <li>Plants use water and carbon dioxide to make sugar.</li>
                  <li>Oxygen is released.</li>
                </ul>
              </div>
            </article>
            <article className="flex flex-col rounded-2xl bg-[#fbead7] p-5 sm:p-6 dark:bg-[#2b221d]">
              <h3 className="text-xl font-extrabold tracking-tight">Practice quizzes</h3>
              <p className="mb-5 mt-1 text-sm text-[#68513e] dark:text-amber-100/85">Test yourself with multiple choice questions.</p>
              <QuizSample />
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-6 text-sm sm:px-8">
          <span className="font-extrabold">NoteDeck</span>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/privacy" className={`rounded-md font-semibold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Privacy</a>
            <a href="/terms" className={`rounded-md font-semibold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Terms</a>
            <a href="/cookies" className={`rounded-md font-semibold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Cookies</a>
            <a href="/login" className={`rounded-md font-semibold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`}>Log in</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
