import { useState, type FormEvent } from "react";
import { Moon, Sun } from "lucide-react";
import { profileUpdateSchema } from "@/src/lib/schemas";
import type { AuthUser } from "@/src/types/api";

interface SettingsViewProps {
  user: AuthUser;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onUserUpdated: (user: AuthUser) => void;
  onAccountDeleted: () => void;
}

export function SettingsView({
  user,
  theme,
  onToggleTheme,
  onUserUpdated,
  onAccountDeleted,
}: SettingsViewProps) {
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmingGoogle, setConfirmingGoogle] = useState(false);
  const googleConfirmation = new URLSearchParams(window.location.search).get("confirmGoogle");

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

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteError("");
    setDeletingAccount(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: deleteEmail, password: deletePassword || undefined }),
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !data.ok) {
        setDeleteError(data.error ?? "Could not delete your account.");
        return;
      }
      onAccountDeleted();
    } catch {
      setDeleteError("Network error. Your account was not confirmed as deleted; try again.");
    } finally {
      setDeletingAccount(false);
    }
  }

  async function confirmGoogleAccount() {
    setDeleteError("");
    setConfirmingGoogle(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: "delete" }),
      });
      const data = (await response.json()) as { authorizationUrl?: string; error?: string };
      if (!response.ok || !data.authorizationUrl) throw new Error(data.error ?? "Could not confirm with Google.");
      window.location.assign(data.authorizationUrl);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "Could not confirm with Google.");
      setConfirmingGoogle(false);
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
            className="rounded-xl bg-[#494bd2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4B5CE8] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141926]"
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
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium whitespace-nowrap transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:hover:bg-[#1C2336]"
        >
          {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4" />}
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
        <h2 className="text-base font-bold">Your data</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Download a copy of your account and study materials, or permanently remove your NoteDeck account and its linked materials from NoteDeck.
        </p>
        <a href="/api/account/export" className="mt-4 inline-flex rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 underline-offset-4 hover:bg-slate-100 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-[#1C2336]">
          Download my data (JSON)
        </a>

        <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
          <h3 className="font-semibold text-red-700 dark:text-red-300">Delete account</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This permanently removes your account and study data from NoteDeck. Confirm your identity before deleting your account.
          </p>
          {deleteError ? (
            <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {deleteError}
            </div>
          ) : null}
          {googleConfirmation === "ready" && !deleteError && (
            <p role="status" className="mt-3 text-sm text-teal-800 dark:text-teal-200">Google account confirmed. You have five minutes to complete deletion.</p>
          )}
          {googleConfirmation === "failed" && !deleteError && (
            <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-300">Google confirmation failed. Choose the Google account linked to NoteDeck and try again.</p>
          )}
          <form onSubmit={handleDeleteAccount} className="mt-4 space-y-3">
            <label htmlFor="delete-account-email" className="block text-sm font-medium">
              Type <span className="font-mono">{user.email}</span> to confirm
            </label>
            <input
              id="delete-account-email"
              type="email"
              autoComplete="email"
              value={deleteEmail}
              onChange={(event) => setDeleteEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-slate-700 dark:bg-[#0B0E17] dark:text-slate-100"
            />
            {user.hasPassword && (
              <label className="block space-y-1.5 text-sm font-medium">
                <span>Current password</span>
                <input type="password" autoComplete="current-password" maxLength={72}
                  value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm dark:border-slate-700 dark:bg-[#0B0E17]" />
              </label>
            )}
            {user.hasGoogle && (
              <button type="button" disabled={confirmingGoogle || deletingAccount} onClick={() => void confirmGoogleAccount()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-60 dark:border-slate-700">
                {confirmingGoogle ? "Opening Google…" : "Confirm with Google"}
              </button>
            )}
            <button
              type="submit"
              disabled={deletingAccount || confirmingGoogle || deleteEmail.trim().toLowerCase() !== user.email.toLowerCase() ||
                ((!user.hasPassword || !deletePassword) && googleConfirmation !== "ready")}
              className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#141926]"
            >
              {deletingAccount ? "Deleting account…" : "Permanently delete my account"}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
