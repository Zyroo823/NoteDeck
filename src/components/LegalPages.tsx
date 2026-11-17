import { ArrowLeft, BookOpen } from "lucide-react";

export type LegalDocument = "privacy" | "terms" | "cookies";

const links: { document: LegalDocument; href: string; label: string }[] = [
  { document: "privacy", href: "/privacy", label: "Privacy" },
  { document: "terms", href: "/terms", label: "Terms" },
  { document: "cookies", href: "/cookies", label: "Cookies" },
];

const documents: Record<LegalDocument, { title: string; sections: { heading: string; paragraphs: string[] }[] }> = {
  privacy: {
    title: "Privacy Policy",
    sections: [
      {
        heading: "Who runs NoteDeck",
        paragraphs: [
          "NoteDeck is currently a project preview operated by John Mar Aledon, based in the Philippines. For privacy requests, contact johnmaraledon823@gmail.com. The countries NoteDeck will serve, its intended user age range, and a retention schedule must still be decided before a public launch.",
        ],
      },
      {
        heading: "Information the app stores",
        paragraphs: [
          "For an account, NoteDeck stores your name, email address, password hash when you use password sign-in, and Google account identifier when you use Google sign-in. It stores the study sets, flashcards, guides, folders, quiz attempts, and generation jobs you create. A completed generation job keeps its generated preview until the job is removed with your account.",
          "When you generate a set, NoteDeck keeps the extracted source text for Ask AI. The text moves from the generation job to the set when you save it. NoteDeck stores Ask AI questions and answers with the set. Clear chat removes the saved conversation, and deleting the set removes its saved source and chat.",
          "Signup asks only for a name, email, and password, or the basic identity needed for Google sign-in. It does not ask for your date of birth, phone number, location, or payment details. The app cannot prevent personal details from being typed into study notes or uploaded files.",
          "The server uses your connection IP address in memory for rate limiting. The hosting provider may process connection and service logs under its own terms. The app stores your theme choice in your browser’s local storage.",
        ],
      },
      {
        heading: "How information is used and shared",
        paragraphs: [
          "Account details are used to authenticate you and control access to your materials. Your materials are used to display, edit, and organize your study work. If you choose AI generation, the notes or uploaded file content you submit is sent to Google Gemini to generate study materials. Google also handles sign-in when you choose Google sign-in. The app does not currently include advertising or analytics services.",
          "When you ask a question in Ask AI, NoteDeck sends it to Gemini along with relevant source text or flashcards and a limited number of recent chat turns.",
          "Do not submit sensitive personal information or another person’s private information in notes or files. Review Google’s own terms and privacy information for its processing of data sent to its services.",
        ],
      },
      {
        heading: "Hosting, storage, and retention",
        paragraphs: [
          "The preview is hosted on Render and stores account and study records in the app’s JSON data file. The current free hosting setup can lose that file on a restart or redeployment. Keep your own copy of important study materials.",
          "You can delete your account from Settings; this removes the account and linked study records from NoteDeck’s active data file. The app does not send deletion requests to Google or erase copies held separately by service providers. A general retention period for inactive accounts and provider logs has not been set.",
        ],
      },
      {
        heading: "Your choices and requests",
        paragraphs: [
          "You can review and correct your profile and study materials in the app, download a JSON copy of your NoteDeck data from Settings, or delete your account there. These actions cover information in the active NoteDeck data file; they do not control copies held by Google, Render, or other service providers.",
          "Depending on the law that applies to you, you may also have rights to object, restrict processing, or make a privacy complaint. For requests that cannot be completed in the app, email johnmaraledon823@gmail.com. GitHub Issues are public. Do not post account details, private notes, passwords, or other personal information there.",
        ],
      },
      {
        heading: "Children and applicable law",
        paragraphs: [
          "The countries NoteDeck will serve and its minimum user age have not been decided. Requirements for child users vary by jurisdiction and by how a service is designed and used. The age policy and any required parent or guardian process must be decided before offering the app to children.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    sections: [
      {
        heading: "Using NoteDeck",
        paragraphs: [
          "NoteDeck is a preview for creating and organizing study materials and taking practice quizzes. Use your own account. You are responsible for the material you submit and must have permission to upload it or send it to an AI provider.",
        ],
      },
      {
        heading: "AI generated material",
        paragraphs: [
          "AI generated flashcards and guides can be incomplete, misleading, or wrong. Check them against your original materials before relying on them for coursework, exams, or other important decisions.",
        ],
      },
      {
        heading: "Availability and your data",
        paragraphs: [
          "This is a free preview. It can be interrupted or reset, and the current hosting setup may lose saved materials on a restart or redeployment. Keep your own copy of important materials. You can download or delete your account from Settings.",
        ],
      },
      {
        heading: "Fees and refunds",
        paragraphs: [
          "NoteDeck does not currently offer paid plans, checkout, or payment processing. No fees are charged by the app, so there is no refund process for this preview. If paid features are introduced, pricing, renewal, cancellation, and refund terms must be published before purchase is offered.",
        ],
      },
      {
        heading: "Account access and contact",
        paragraphs: [
          "Administrators may manage account roles or suspend access to protect the service or address misuse. NoteDeck is operated by John Mar Aledon in the Philippines. Contact johnmaraledon823@gmail.com for account or privacy requests. GitHub Issues are public and must not be used to send account credentials or private information.",
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    sections: [
      {
        heading: "Cookies used by NoteDeck",
        paragraphs: [
          "NoteDeck uses an HTTP-only, SameSite=Lax session cookie to keep you signed in. It lasts up to seven days. During Google sign-in, a second short-lived HTTP-only cookie protects the sign-in request and expires after ten minutes. These cookies support account access and security.",
          "The app stores your light or dark theme choice in browser local storage, not in a cookie. The app does not currently set advertising or analytics cookies, and it does not use non-essential cookies. A cookie consent banner is therefore not shown. If non-essential cookies or similar tracking are added, the app must reassess consent and notice requirements before enabling them.",
          "When you leave NoteDeck to sign in with Google, Google may set cookies according to Google’s own policies. Those cookies are controlled by Google, not NoteDeck.",
        ],
      },
    ],
  },
};

export function LegalPage({ document }: { document: LegalDocument }) {
  const content = documents[document];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <a href="#legal-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg">
        Skip to policy
      </a>
      <div className="mx-auto max-w-3xl">
        <nav aria-label="Legal pages" className="flex flex-wrap items-center gap-4 border-b border-slate-200 pb-5 text-sm dark:border-slate-800">
          <a href="/" className="inline-flex items-center gap-2 font-semibold hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500">
            <BookOpen aria-hidden="true" className="size-5 text-[#5B6CFA]" /> NoteDeck
          </a>
          {links.map((link) => (
            <a key={link.document} href={link.href} aria-current={document === link.document ? "page" : undefined}
              className="hover:text-indigo-600 focus-visible:outline-2 focus-visible:outline-indigo-500">{link.label}</a>
          ))}
        </nav>
        <article id="legal-content" tabIndex={-1} className="space-y-8 py-8 focus-visible:outline-none">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">{content.title}</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Updated November 16, 2026</p>
            {document !== "cookies" ? (
              <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                Pre-launch draft. The intended user age, supported countries, and retention rules still need to be decided and reviewed. This page is not a legal compliance certification.
              </p>
            ) : null}
          </header>
          {content.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="leading-relaxed text-slate-700 dark:text-slate-300">{paragraph}</p>
              ))}
            </section>
          ))}
          {document !== "cookies" ? (
            <aside className="space-y-2 border-t border-slate-200 pt-5 text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <p>For privacy or account requests, email the operator. GitHub Issues are public; do not post personal details or account information there.</p>
              <a href="mailto:johnmaraledon823@gmail.com"
                className="inline-flex rounded-lg font-medium text-indigo-700 underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-300">
                Email NoteDeck privacy contact
              </a>
            </aside>
          ) : null}
          <a href="/" className="inline-flex items-center gap-2 rounded-lg font-medium text-indigo-700 underline focus-visible:outline-2 focus-visible:outline-indigo-500 dark:text-indigo-300">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to NoteDeck
          </a>
        </article>
      </div>
    </main>
  );
}

export function NotFoundPage({ onHome }: { onHome: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 py-12 text-center text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <p className="text-sm font-semibold tracking-wide text-[#494bd2] dark:text-[#a5b4fc]">404</p>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="max-w-md text-sm text-slate-600 dark:text-slate-400">
        This link may be outdated, or the page may have moved.
      </p>
      <button type="button" onClick={onHome}
        className="inline-flex items-center gap-2 rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4B5CE8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500">
        <ArrowLeft aria-hidden="true" className="size-4" /> Go home
      </button>
    </main>
  );
}
