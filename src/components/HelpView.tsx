import { ChevronDown, Mail } from "lucide-react";
import { assistantFaq } from "@/src/chatbot/knowledge";
import { StudyChatMarkdown } from "@/src/components/StudyChatMarkdown";

const feedbackEmail = "johnmaraledon823@gmail.com";

export function HelpView() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Help and Feedback</h1>

      <section aria-labelledby="help-questions" className="space-y-3">
        <h2 id="help-questions" className="text-lg font-semibold">Frequently asked questions</h2>
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#141926]">
          {assistantFaq.map(({ question, answer }) => (
            <details key={question} className="group px-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-slate-600 group-open:rotate-180 dark:text-slate-400" />
              </summary>
              <div className="pb-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                <StudyChatMarkdown text={answer} allowLinks={false} />
              </div>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="help-feedback" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 dark:border-slate-800 dark:bg-[#141926]">
        <h2 id="help-feedback" className="text-lg font-semibold">Send feedback</h2>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Report a problem, ask a question, or suggest an improvement. Include the page you were on and what happened.
        </p>
        <a href={`mailto:${feedbackEmail}?subject=NoteDeck%20feedback`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3739aa]">
          <Mail aria-hidden="true" className="size-4" /> Email feedback
        </a>
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Opens a draft in your email app. You can also write to <span className="break-all">{feedbackEmail}</span>.
        </p>
      </section>
    </div>
  );
}
