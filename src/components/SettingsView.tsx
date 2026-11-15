import { useState, type FormEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { profileUpdateSchema } from "@/src/lib/schemas";
import type { AuthUser } from "@/src/types/api";

interface SettingsViewProps {
  user: AuthUser;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onUserUpdated: (user: AuthUser) => void;
}

export function SettingsView({
  user,
  theme,
  onToggleTheme,
  onUserUpdated,
}: SettingsViewProps) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSavedMessage("");

    const parsed = profileUpdateSchema.safeParse({ name });
    if (!parsed.success) {
      setErrorMessage(parsed.error.issues[0]?.message ?? "Invalid name.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json()) as { user?: AuthUser; error?: string };
      if (!res.ok || !data.user) {
        setErrorMessage(data.error ?? "Failed to update profile.");
        return;
      }
      onUserUpdated(data.user);
      setSavedMessage("Profile updated.");
    } catch {
      setErrorMessage("Network error while saving profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Update your display name and switch between dark and light themes.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
        <h2 className="text-base font-bold">Profile</h2>

        {errorMessage ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {errorMessage}
          </div>
        ) : null}

        {savedMessage ? (
          <div
            role="status"
            className="mt-4 rounded-xl border border-teal-300 bg-teal-50 px-4 py-3 text-sm text-teal-800 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200"
          >
            {savedMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
          <div>
            <label htmlFor="settings-email" className="mb-1.5 block text-sm font-medium">
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={user.email}
              disabled
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm text-slate-500 dark:border-slate-800 dark:bg-[#0B0E17] dark:text-slate-400"
            />
          </div>

          <div>
            <label htmlFor="settings-name" className="mb-1.5 block text-sm font-medium">
              Display name
            </label>
            <input
              id="settings-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#5B6CFA] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4B5CE8] disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save profile"}
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
        <div>
          <h2 className="text-base font-bold">Appearance</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Active theme: {theme === "dark" ? "Dark mode" : "Light mode"}
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-[#1C2336]"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>
      </section>
    </div>
  );
}
