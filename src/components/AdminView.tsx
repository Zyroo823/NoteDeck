import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Search } from "lucide-react";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  suspended: boolean;
  createdAt: string;
}

type AccessUpdate = { role: ManagedUser["role"] } | { suspended: boolean };
type AccountUpdate = AccessUpdate | { name: string };

const joinedDate = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
});
const sortColumns = [
  { key: "name", label: "Name" },
  { key: "role", label: "Role" },
  { key: "createdAt", label: "Joined" },
] as const;
type SortKey = (typeof sortColumns)[number]["key"];

const monoLabel = "font-mono-nums text-xs font-medium tracking-wider text-slate-600 dark:text-slate-400";
const line = "border-slate-200 dark:border-slate-800";
const surface = "bg-white dark:bg-[#141926]";
const panel = `rounded-2xl border p-4 sm:p-6 ${line} ${surface}`;
const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#494bd2] dark:focus-visible:outline-[#a5b4fc]";
const disabledStyle = "disabled:cursor-not-allowed disabled:opacity-50";
const control = `h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-[#0B0E17] ${focusRing} ${disabledStyle}`;
const button = `inline-flex h-10 shrink-0 items-center justify-center rounded-xl text-sm font-medium transition ${focusRing} ${disabledStyle}`;
const secondary = "border border-slate-300 bg-white enabled:hover:bg-slate-100 dark:border-slate-700 dark:bg-[#141926] dark:enabled:hover:bg-[#1C2336]";
const destructive = "border border-red-300 text-red-700 enabled:hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:enabled:hover:bg-red-950/40";
const primary = "bg-[#494bd2] text-white enabled:hover:bg-[#4B5CE8]";

function confirmationText(user: ManagedUser, update: AccessUpdate) {
  if ("role" in update) {
    const effect = update.role === "admin"
      ? "They will be able to manage user roles and account access."
      : "They will lose access to Manage Users.";
    return { title: `Change ${user.email} from ${user.role} to ${update.role}?`, message: effect, label: "Change role" };
  }
  return update.suspended
    ? { title: `Deactivate ${user.email}?`, message: "They will be signed out and unable to sign in until reactivated.", label: "Deactivate" }
    : { title: `Reactivate ${user.email}?`, message: "They will be able to sign in again.", label: "Reactivate" };
}

export function AdminView({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: "ascending" | "descending" }>({
    key: "name", direction: "ascending",
  });
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [pendingAccess, setPendingAccess] = useState<{ user: ManagedUser; update: AccessUpdate } | null>(null);
  const [draftName, setDraftName] = useState("");
  const [editError, setEditError] = useState("");
  const userDialog = useRef<HTMLDialogElement>(null);

  const loadUsers = useCallback(async () => {
    const response = await fetch("/api/admin/users");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Could not load users.");
    setUsers(data.users);
  }, []);

  useEffect(() => {
    loadUsers().catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [loadUsers]);

  useEffect(() => {
    if ((editing || pendingAccess) && !userDialog.current?.open) userDialog.current?.showModal();
  }, [editing, pendingAccess]);

  function closeUserDialog() {
    userDialog.current?.close();
    setEditing(null);
    setPendingAccess(null);
  }

  function sortButton(key: SortKey, label: string) {
    return (
      <button type="button" className={`inline-flex items-center gap-1 hover:underline ${focusRing}`}
        onClick={() => setSort((current) => ({
          key,
          direction: current.key === key && current.direction === "ascending" ? "descending" : "ascending",
        }))}>
        {label}
        {sort.key === key && <span aria-hidden="true">{sort.direction === "ascending" ? "↑" : "↓"}</span>}
      </button>
    );
  }

  async function updateUser(user: ManagedUser, update: AccountUpdate) {
    setBusy(user.id);
    setError("");
    setEditError("");
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
      setNotice(`Updated ${user.email}.`);
      if ("name" in update) closeUserDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update the account.";
      if ("name" in update) setEditError(message);
      else setError(message);
    } finally {
      setBusy("");
    }
  }

  function startEdit(user: ManagedUser) {
    setDraftName(user.name);
    setEditError("");
    setEditing(user);
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editing) void updateUser(editing, { name: draftName });
  }

  function submitAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pendingAccess) return;
    closeUserDialog();
    void updateUser(pendingAccess.user, pendingAccess.update);
  }

  const confirmation = pendingAccess ? confirmationText(pendingAccess.user, pendingAccess.update) : null;
  const activeAdmins = users.filter((user) => user.role === "admin" && !user.suspended);
  const search = query.trim().toLowerCase();
  const visibleUsers = users
    .filter((user) => (
      (user.name.toLowerCase().includes(search) || user.email.toLowerCase().includes(search)) &&
      (roleFilter === "all" || user.role === roleFilter)
    ))
    .sort((a, b) => {
      const order = sort.key === "createdAt"
        ? (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)
        : a[sort.key].localeCompare(b[sort.key], undefined, { sensitivity: "base" });
      return order * (sort.direction === "ascending" ? 1 : -1) || a.email.localeCompare(b.email);
    });

  return (
    <div className="space-y-5 text-slate-900 dark:text-slate-100">
      <header className={`border-b pb-3 ${line}`}>
        <p className="text-xs font-medium tracking-wide text-slate-600 dark:text-slate-400">Admin</p>
        <h1 id="manage-users-heading" className="mt-1 text-2xl font-bold tracking-tight">
          Manage Users {!loading && <span className="text-lg font-normal text-slate-600 dark:text-slate-400">({visibleUsers.length})</span>}
        </h1>
      </header>

      <div className={`grid gap-4 lg:grid-cols-[2fr_1fr] ${panel}`}>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-medium">Search Users</span>
          <span className="relative block">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Name or email"
              className={`w-full pl-9 placeholder:text-slate-600 dark:placeholder:text-slate-400 ${control}`} />
          </span>
        </label>
        <label className="grid min-w-0 gap-1.5">
          <span className="text-sm font-medium">Filter by Role</span>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} className={control}>
            <option value="all">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </label>
      </div>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
      {notice && <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{notice}</p>}

      {loading ? (
        <p role="status" className="text-sm text-slate-600 dark:text-slate-400">Loading accounts…</p>
      ) : visibleUsers.length > 0 ? (
        <div className={panel}>
          <div role="group" aria-label="Sort users"
            className={`flex gap-4 pb-3 lg:hidden ${monoLabel}`}>
            {sortColumns.map(({ key, label }) => <span key={key}>{sortButton(key, label)}</span>)}
          </div>
          <table role="table" aria-labelledby="manage-users-heading" className="w-full table-fixed text-left text-sm max-lg:block">
            <thead className={`border-b max-lg:hidden ${line} ${monoLabel}`}>
              <tr>
                <th scope="col" aria-sort={sort.key === "name" ? sort.direction : undefined} className="w-[26%] px-2 py-3">{sortButton("name", "Name")}</th>
                <th scope="col" className="px-2 py-3">Email</th>
                <th scope="col" aria-sort={sort.key === "role" ? sort.direction : undefined} className="w-24 px-2 py-3 xl:w-34 xl:pl-4">{sortButton("role", "Role")}</th>
                <th scope="col" aria-sort={sort.key === "createdAt" ? sort.direction : undefined} className="w-28 px-2 py-3 xl:w-36 xl:pl-4">{sortButton("createdAt", "Joined")}</th>
                <th scope="col" className="w-40 px-2 py-3 text-right xl:w-44">Actions</th>
              </tr>
            </thead>
            <tbody role="rowgroup" className="max-lg:block max-lg:space-y-3 lg:divide-y lg:divide-slate-200 dark:lg:divide-slate-800">
              {visibleUsers.map((user) => {
                const isCurrentUser = user.id === currentUserId;
                const isLastAdmin = activeAdmins.length === 1 && activeAdmins[0].id === user.id;
                const protectedReason = isLastAdmin ? "This is the only admin who can sign in." : isCurrentUser ? "You can’t change your own role or access." : "";
                const joined = new Date(user.createdAt);
                const roleHelpId = `role-help-${user.id}`;
                const accessHelpId = `access-help-${user.id}`;

                return (
                  <tr key={user.id} role="row" aria-busy={busy === user.id}
                    className={`hover:bg-slate-100 max-lg:grid max-lg:grid-cols-[minmax(0,1fr)_auto] max-lg:items-center max-lg:gap-x-3 max-lg:gap-y-2 max-lg:rounded-xl max-lg:border max-lg:p-3 lg:h-14 dark:hover:bg-[#1C2336] ${line} ${
                      user.suspended ? "opacity-85" : ""
                    }`}>
                    <th scope="row" role="rowheader" className="px-2 py-2 text-left font-medium max-lg:col-span-2 max-lg:p-0">
                      <div className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                        <span className="truncate" title={user.name}>{user.name}</span>
                        {isCurrentUser && <span className="shrink-0 text-xs font-normal text-slate-600 dark:text-slate-400">(YOU)</span>}
                        {user.suspended && <span className="shrink-0 rounded-md border border-slate-300 px-1.5 text-xs font-normal text-slate-600 dark:border-slate-700 dark:text-slate-400">Deactivated</span>}
                      </div>
                    </th>
                    <td role="cell" title={user.email} className="px-2 py-2 text-slate-600 max-lg:col-span-2 max-lg:p-0 max-lg:wrap-anywhere lg:truncate dark:text-slate-400">{user.email}</td>
                    <td role="cell" className="px-2 py-1.5 max-lg:p-0 xl:pl-4">
                      <div className="group relative w-full max-w-24" tabIndex={protectedReason ? 0 : undefined}
                        aria-describedby={protectedReason ? roleHelpId : undefined}>
                        <select value={user.role} aria-label={`Role for ${user.email}`} disabled={!!busy || !!protectedReason}
                          onChange={(event) => {
                            const role = event.target.value;
                            // Keep the current value until the confirmation and server update succeed.
                            event.currentTarget.value = user.role;
                            if (role === "admin" || role === "user") setPendingAccess({ user, update: { role } });
                          }}
                          className={`w-full ${control}`}>
                          <option value="admin">Admin</option>
                          <option value="user">User</option>
                        </select>
                        {protectedReason && <ProtectionTooltip id={roleHelpId} reason={protectedReason} />}
                      </div>
                    </td>
                    <td role="cell" className="px-2 py-2 whitespace-nowrap text-slate-600 max-lg:p-0 xl:pl-4 dark:text-slate-400">
                      {Number.isNaN(joined.getTime()) ? "—" : <time dateTime={user.createdAt}>{joinedDate.format(joined)}</time>}
                    </td>
                    <td role="cell" className="px-2 py-1.5 max-lg:col-span-2 max-lg:p-0">
                      <div className="flex items-center gap-2 lg:justify-end xl:gap-3">
                        <button type="button" aria-label={`Edit display name for ${user.email}`} disabled={!!busy}
                          onClick={() => startEdit(user)}
                          className={`w-10 ${button} ${secondary}`}>
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                        <div className="group relative" tabIndex={protectedReason ? 0 : undefined}
                          aria-describedby={protectedReason ? accessHelpId : undefined}>
                          <button type="button" disabled={!!busy || !!protectedReason}
                            onClick={() => setPendingAccess({ user, update: { suspended: !user.suspended } })}
                            className={`px-2.5 ${button} ${
                              user.suspended ? secondary : destructive
                            }`}>
                            {user.suspended ? "Reactivate" : "Deactivate"}
                          </button>
                          {protectedReason && <ProtectionTooltip id={accessHelpId} reason={protectedReason} alignRight />}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : !error && (
        <p className={`text-sm ${panel}`}>
          {users.length ? "No users match these filters." : "No accounts to display."}
        </p>
      )}

      <dialog ref={userDialog} aria-labelledby="admin-user-dialog-title"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) closeUserDialog();
        }}
        className={`fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md text-slate-900 backdrop:bg-black/60 dark:text-slate-100 ${panel}`}>
        {editing ? (
          <form onSubmit={submitEdit} className="space-y-4">
            <div>
              <h2 id="admin-user-dialog-title" className="text-lg font-bold">Edit display name</h2>
              <p className="mt-1 text-sm wrap-anywhere text-slate-600 dark:text-slate-400">{editing.email}</p>
            </div>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">Display name</span>
              <input autoFocus required minLength={2} maxLength={60} value={draftName}
                onChange={(event) => setDraftName(event.target.value)} className={control} />
            </label>
            {editError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{editError}</p>}
            <div className="flex justify-end gap-3">
              <button type="button" disabled={!!busy} onClick={closeUserDialog}
                className={`px-4 ${button} ${secondary}`}>Cancel</button>
              <button type="submit" disabled={!!busy || draftName.trim() === editing.name}
                className={`px-4 ${button} ${primary}`}>{busy ? "Saving…" : "Save name"}</button>
            </div>
          </form>
        ) : confirmation && (
          <form onSubmit={submitAccess} className="space-y-4">
            <h2 id="admin-user-dialog-title" className="text-lg font-bold wrap-anywhere">{confirmation.title}</h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{confirmation.message}</p>
            <div className="flex justify-end gap-3">
              <button type="button" autoFocus onClick={closeUserDialog} className={`px-4 ${button} ${secondary}`}>Cancel</button>
              <button type="submit" className={`px-4 ${button} ${confirmation.label === "Deactivate" ? "bg-red-600 text-white enabled:hover:bg-red-700" : primary}`}>
                {confirmation.label}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}

function ProtectionTooltip({ id, reason, alignRight = false }: { id: string; reason: string; alignRight?: boolean }) {
  return (
    <span id={id} role="tooltip"
      className={`invisible absolute top-full z-10 mt-1 w-max max-w-40 rounded-lg border px-2 py-1 text-left text-xs group-hover:visible group-focus-within:visible ${alignRight ? "left-0 lg:right-0 lg:left-auto" : "left-0"} ${surface} ${line}`}>
      {reason}
    </span>
  );
}
