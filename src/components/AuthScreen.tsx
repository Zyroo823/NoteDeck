import { useState, type FormEvent } from "react";
import { BookOpen, Moon, Sun } from "lucide-react";
import { loginSchema, signupSchema } from "@/src/lib/schemas";
import type { AuthUser } from "@/src/types/api";

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
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (mode === "signup") {
      const parsed = signupSchema.safeParse({ name, email, password });
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

  async function handleDemoLogin() {
    setErrorMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/demo", { method: "POST" });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setErrorMessage(data.error ?? "Could not start demo session.");
        return;
      }
      onAuthenticated(data.user);
    } catch {
      setErrorMessage("Network error while starting demo session.");
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

      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-[#141926]">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#5B6CFA] text-white">
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

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
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
              placeholder="you@school.edu"
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
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
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#5B6CFA] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4B5CE8] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141926]"
          >
            {loading ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          <span className="text-xs font-medium text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        </div>

        <button
          type="button"
          onClick={handleDemoLogin}
          disabled={loading}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#1C2336] dark:text-slate-100 dark:hover:bg-slate-700/60"
        >
          Continue with Demo Account
        </button>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          {mode === "login" ? "Need an account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setErrorMessage("");
              onSwitchMode(mode === "login" ? "signup" : "login");
            }}
            className="font-semibold text-[#5B6CFA] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA]"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </main>
  );
}
