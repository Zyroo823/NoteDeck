import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { AdminLayoutPrototype, isAdminPrototypeVariant } from "./AdminLayoutPrototype";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  suspended: boolean;
  createdAt: string;
}

export function AdminView({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const variant = new URLSearchParams(window.location.search).get("variant");

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load users.");
    setUsers(data.users);
  }, []);

  useEffect(() => {
    loadUsers().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [loadUsers]);

  if (import.meta.env.DEV && isAdminPrototypeVariant(variant) && !loading && !error) {
    return <AdminLayoutPrototype users={users} currentUserId={currentUserId} variant={variant} />;
  }

  async function updateUser(user: ManagedUser, update: { role: "admin" | "user" } | { suspended: boolean }) {
    const description = "role" in update
      ? `Change ${user.name}'s role to ${update.role}?`
      : `${update.suspended ? "Suspend" : "Restore"} access for ${user.name}?`;
    if (!window.confirm(description)) return;
    setBusy(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(update),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not update the account.");
      await loadUsers();
      setNotice(`Updated ${user.name}'s account.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the account.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-[#5B6CFA]/15 p-3 text-[#5B6CFA]"><ShieldCheck className="h-6 w-6" /></span>
        <div><h1 className="text-2xl font-bold tracking-tight">Manage users</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Manage account access and administrator roles.</p></div>
      </div>
      {error && <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
      {notice && <div role="status" className="rounded-xl bg-teal-50 p-4 text-sm text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">{notice}</div>}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#141926]">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <Users className="h-5 w-5 text-[#5B6CFA]" /><h2 className="font-bold">Accounts</h2>
          <span className="ml-auto text-sm text-slate-500">{users.length} total</span>
        </div>
        {loading ? <p className="p-5 text-sm">Loading accounts...</p> : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {users.map((user) => (
              <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="font-semibold">{user.name}{user.id === currentUserId && <span className="ml-2 text-xs text-slate-500">You</span>}</p>
                  <p className="break-all text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                  <p className={`mt-1 text-xs font-medium ${user.suspended ? "text-red-500" : "text-teal-600 dark:text-teal-400"}`}>{user.suspended ? "Suspended" : "Active"}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`role-${user.id}`}>Role for {user.name}</label>
                  <select id={`role-${user.id}`} value={user.role} disabled={!!busy || user.id === currentUserId}
                    onChange={(event) => void updateUser(user, { role: event.target.value as "admin" | "user" })}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-[#0B0E17] disabled:opacity-50">
                    <option value="user">User</option><option value="admin">Admin</option>
                  </select>
                  <button type="button" disabled={!!busy || user.id === currentUserId}
                    onClick={() => void updateUser(user, { suspended: !user.suspended })}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
                    {busy === user.id ? "Saving..." : user.suspended ? "Restore access" : "Suspend"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
