import { useState } from "react";
import { ArrowDown, ArrowRight, ChevronDown, Moon, RotateCcw, Sun } from "lucide-react";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4547cd] dark:focus-visible:outline-indigo-300";
const primaryLink = `inline-flex items-center justify-center gap-2 rounded-xl bg-[#494bd2] px-5 py-3 font-bold text-white transition-colors hover:bg-[#3739aa] ${focus}`;
const sectionHeading = "text-2xl font-extrabold tracking-tight";
const bodyText = "text-sm leading-relaxed text-slate-600 dark:text-slate-400";
const footerLink = `inline-flex min-h-11 items-center gap-2 rounded-md font-semibold hover:text-[#3739aa] dark:hover:text-indigo-200 ${focus}`;
const quizOptions = ["Chloroplasts", "Mitochondria", "Ribosomes"];

const features = [
  { title: "Generate from your notes", description: "Paste class notes or upload a PDF or PowerPoint. NoteDeck turns the material into a draft set of flashcards and a study guide." },
  { title: "Ask AI about a set", description: "Ask for an explanation, compare two concepts, or find out what to review first. Answers draw on the material in your set." },
  { title: "Organize sets in folders", description: "Group your sets by class, topic, or exam so you can find them again when it’s time to study." },
];

const studySteps = [
  { title: "Add your notes", description: "Paste your notes or upload your class slides or readings." },
  { title: "Review the draft", description: "Check the generated cards against your notes and edit them before saving." },
  { title: "Study your set", description: "Flip through the cards, read your study guide, or take a practice quiz." },
];

const questions = [
  { question: "Can I try NoteDeck without an account?", answer: <>Yes. You can flip a sample flashcard, read a sample study guide, and answer a practice question above. Create an account to save your own sets.</> },
  { question: "What can I upload?", answer: <>Upload up to two PDF or PowerPoint (.pptx) files at a time. Each file can be up to 25 MB and 80 pages or slides. You can also paste text directly.</> },
  { question: "Can I make flashcards myself?", answer: <>Yes. Create a flashcard set and enter your own terms and definitions.</> },
  { question: "Can I edit what AI generates?", answer: <>Yes. You can edit the generated flashcards and the study guide summary in the preview before saving.</> },
  { question: "What does Ask AI use to answer questions?", answer: <>Ask AI uses the source text saved with your generated set and its list of terms. For a set you made manually, it uses your flashcards.</> },
  {
    question: "What happens to the notes I submit?",
    answer: <>When you generate with AI, NoteDeck sends the material you submit to Google Gemini. When you save the set, NoteDeck keeps the extracted text for Ask AI. Read the <a href="/privacy" className={`rounded-sm font-semibold text-indigo-700 underline underline-offset-2 dark:text-indigo-300 ${focus}`}>Privacy Policy</a> for details.</>,
  },
];

const contacts = [
  { label: "johnmaraledon823@gmail.com", icon: "gmail", href: "mailto:johnmaraledon823@gmail.com", external: false },
  { label: "Facebook", icon: "facebook", href: "https://www.facebook.com/john.mar.aledon.2024", external: true },
  { label: "GitHub", icon: "github", href: "https://github.com/Zyroo823", external: true },
];

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
          <a href="#features" className={`hidden rounded-md text-sm font-semibold text-slate-600 hover:text-[#3739aa] md:inline dark:text-slate-300 dark:hover:text-indigo-200 ${focus}`}>Features</a>
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

        <section id="features" aria-labelledby="features-heading" className="scroll-mt-6 border-t border-slate-200 py-10 sm:py-14 dark:border-slate-800">
          <h2 id="features-heading" className={sectionHeading}>Features</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-3 sm:gap-8">
            {features.map(({ title, description }) => (
              <article key={title}>
                <h3 className="font-bold">{title}</h3>
                <p className={`mt-1.5 ${bodyText}`}>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="study-steps-heading" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 dark:border-slate-800 dark:bg-[#141926]">
          <h2 id="study-steps-heading" className={sectionHeading}>How it works</h2>
          <ol className="mt-5 grid list-none gap-5 sm:grid-cols-3 sm:gap-6" role="list">
            {studySteps.map(({ title, description }, index) => (
              <li key={title} className="flex items-start gap-3">
                <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-700 dark:bg-indigo-400/10 dark:text-indigo-200">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className={`mt-1 ${bodyText}`}>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="grid gap-4 py-10 sm:py-14 lg:grid-cols-[1fr_2fr] lg:gap-8">
          <h2 id="faq-heading" className={sectionHeading}>Frequently asked questions</h2>
          <div className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {questions.map(({ question, answer }) => (
              <details key={question} className="group">
                <summary className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-md py-3 text-sm font-bold hover:text-[#3739aa] dark:hover:text-indigo-200 [&::-webkit-details-marker]:hidden ${focus}`}>
                  {question}
                  <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-500 group-open:rotate-180 dark:text-slate-400" />
                </summary>
                <p className={`max-w-prose pb-4 pr-6 ${bodyText}`}>{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-sm sm:px-8 md:flex-row md:items-start md:justify-between">
          <div>
            <a href="/" className={footerLink}>NoteDeck</a>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-4 text-slate-600 dark:text-slate-400">
              <a href="/privacy" className={footerLink}>Privacy</a>
              <a href="/terms" className={footerLink}>Terms</a>
              <a href="/cookies" className={footerLink}>Cookies</a>
              <a href="/login" className={footerLink}>Log in</a>
            </nav>
          </div>
          <section aria-labelledby="contact-heading">
            <h2 id="contact-heading" className="flex min-h-11 items-center font-bold">Contact</h2>
            <ul className="flex flex-wrap gap-x-4 text-slate-600 dark:text-slate-400">
              {contacts.map(({ label, icon, href, external }) => (
                <li key={icon} className={external ? undefined : "max-sm:w-full"}>
                  <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={footerLink}>
                    <img src={`/icons/${icon}.svg`} alt="" width="18" height="18" className={`size-4.5 shrink-0 object-contain ${icon === "github" ? "dark:invert" : ""}`} />
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </footer>
    </div>
  );
}
