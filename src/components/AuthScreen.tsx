import { useEffect, useState, type FormEvent } from "react";
import { BookOpen, Moon, Sun } from "lucide-react";
import { loginSchema, signupSchema } from "@/src/lib/schemas";
import type { AuthUser } from "@/src/types/api";

const googleSignInMessages = new Map([
  ["unavailable", "Gmail sign-in is not set up yet. You can still sign in with your email and password."],
  ["expired", "This Gmail sign-in request expired. Please try again."],
  ["cancelled", "Gmail sign-in was cancelled."],
  ["failed", "Could not sign in with Gmail. Please try again."],
  ["gmail-required", "Choose a verified Gmail account to continue."],
  ["signup-required", "No NoteDeck account is linked to that Google account yet. Select Sign up and agree to the Terms first."],
  ["terms-required", "Agree to the Terms of Service before creating an account."],
  ["existing", "This NoteDeck account is already linked to a different Google account."],
  ["suspended", "This account has been suspended. Contact an administrator."],
]);

interface AuthScreenProps {
  mode: "login" | "signup";
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onSwitchMode: (mode: "login" | "signup") => void;
  onAuthenticated: (user: AuthUser) => void;
}

export function AuthScreen({
  mode,
  theme,
  onToggleTheme,
  onSwitchMode,
  onAuthenticated,
}: AuthScreenProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState(() => {
    const outcome = new URLSearchParams(window.location.search).get("google");
    return googleSignInMessages.get(outcome ?? "") ?? "";
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAcceptTerms(false);
  }, [mode]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (mode === "signup") {
      const parsed = signupSchema.safeParse({ name, email, password, acceptTerms });
      if (!parsed.success) {
        setErrorMessage(parsed.error.issues[0]?.message ?? "Check your signup details.");
        return;
      }

      setLoading(true);
      try {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = (await res.json()) as { user?: AuthUser; error?: string };
        if (!res.ok || !data.user) {
          setErrorMessage(data.error ?? "Signup failed.");
          return;
        }
        onAuthenticated(data.user);
      } catch {
        setErrorMessage("Network error while creating your account.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Check your login details.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setErrorMessage(data.error ?? "Invalid email or password.");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setErrorMessage("Network error while signing in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    if (mode === "signup" && !acceptTerms) {
      setErrorMessage("Agree to the Terms of Service before creating an account.");
      return;
    }

    setErrorMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: mode, acceptTerms }),
      });
      const data = (await res.json()) as { authorizationUrl?: string; error?: string };
      if (!res.ok || !data.authorizationUrl) {
        setErrorMessage(data.error ?? "Could not start Gmail sign-in.");
        return;
      }
      window.location.assign(data.authorizationUrl);
    } catch {
      setErrorMessage("Network error while starting Gmail sign-in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-12 dark:bg-[#0B0E17]">
      <button
        type="button"
        onClick={onToggleTheme}
        aria-label="Toggle color theme"
        className="fixed right-4 top-4 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-200 dark:hover:bg-[#1C2336]"
      >
        {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
      </button>

      <a href="#auth-form" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg">
        Skip to sign in form
      </a>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-[#141926]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#494bd2] text-white">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              {mode === "login" ? "Log in to NoteDeck" : "Create your NoteDeck account"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Flashcards, study guides, and active recall quizzes
            </p>
          </div>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}

        <form id="auth-form" tabIndex={-1} onSubmit={handleSubmit} className="space-y-4 focus-visible:outline-none" noValidate>
          {mode === "signup" ? (
            <div>
              <label
                htmlFor="auth-name"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Full name
              </label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>
          ) : null}

          <div>
            <label
              htmlFor="auth-email"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <div>
            <label
              htmlFor="auth-password"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "login" ? "Enter your password" : "At least 8 characters"}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          {mode === "signup" ? (
            <label htmlFor="accept-terms" className="flex items-start gap-3 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
              <input
                id="accept-terms"
                type="checkbox"
                checked={acceptTerms}
                aria-required="true"
                onChange={(event) => setAcceptTerms(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-[#494bd2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4547cd]"
              />
              <span>
                I agree to the <a href="/terms" className="font-semibold text-[#3739aa] underline dark:text-indigo-300">Terms of Service</a> and have read the <a href="/privacy" className="font-semibold text-[#3739aa] underline dark:text-indigo-300">Privacy Policy</a>.
              </span>
            </label>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4B5CE8] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141926]"
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-medium text-slate-500">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#1C2336] dark:text-slate-100 dark:hover:bg-slate-700/60"
        >
          {mode === "signup" ? "Sign up with Gmail" : "Continue with Gmail Account"}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {mode === "login" ? "Need an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              onSwitchMode(mode === "login" ? "signup" : "login");
            }}
            className="font-semibold text-[#494bd2] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:text-[#a5b4fc]"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
      <a href="/" className="mt-5 rounded-md text-sm font-medium text-slate-600 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#5B6CFA] dark:text-slate-300">
        ← Back to NoteDeck
      </a>
      <nav aria-label="Legal information" className="mt-4 flex gap-5 text-xs text-slate-500 dark:text-slate-400">
        <a href="/privacy" className="hover:underline">Privacy Policy</a>
        <a href="/terms" className="hover:underline">Terms of Service</a>
        <a href="/cookies" className="hover:underline">Cookie Policy</a>
      </nav>
    </main>
  );
}
