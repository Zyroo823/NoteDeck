// Throwaway preview: compare a directory, an account inspector, and an access board.
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

const layouts = [
  { key: "directory", name: "Directory" },
  { key: "inspector", name: "Account inspector" },
  { key: "access", name: "Access board" },
] as const;

type Variant = (typeof layouts)[number]["key"];
type Account = { id: string; name: string; email: string; role: "admin" | "user"; suspended: boolean };
const muted = "text-slate-600 dark:text-slate-400";
const rule = "border-slate-200 dark:border-slate-800";
const outline = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500";

export function isAdminPrototypeVariant(value: string | null): value is Variant {
  return layouts.some(({ key }) => key === value);
}

function roleOf(user: Account) { return user.role === "admin" ? "Administrator" : "User"; }
function accessOf(user: Account) { return user.suspended ? "Suspended" : "Active"; }

export function AdminLayoutPrototype({ users, currentUserId, variant }: {
  users: Account[];
  currentUserId: string;
  variant: Variant;
}) {
  const [layout, setLayout] = useState(variant);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(currentUserId);
  const selected = users.find((user) => user.id === selectedId) ?? users[0];
  const index = layouts.findIndex(({ key }) => key === layout);
  const search = query.trim().toLowerCase();
  const matches = users.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(search));

  useEffect(() => {
    function onPopState() {
      const value = new URLSearchParams(window.location.search).get("variant");
      if (isAdminPrototypeVariant(value)) setLayout(value);
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const cycle = useCallback((offset: number) => {
    const next = layouts[(index + offset + layouts.length) % layouts.length].key;
    const url = new URL(window.location.href);
    url.searchParams.set("variant", next);
    window.history.replaceState(null, "", url);
    setLayout(next);
  }, [index]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ||
          (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]"))) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        cycle(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cycle]);

  function accountName(user: Account) {
    return <span className="font-medium">{user.name}{user.id === currentUserId && <span className={`ml-2 text-xs ${muted}`}>You</span>}</span>;
  }

  return (
    <main className="mx-auto max-w-5xl pb-24">
      <header className={`mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5 ${rule}`}>
        <h1 className="text-3xl font-semibold tracking-tight">Manage users</h1>
        <span className={`text-sm tabular-nums ${muted}`}>{users.length} {users.length === 1 ? "account" : "accounts"}</span>
      </header>

      {layout === "directory" && (
        <>
          <label className="sr-only" htmlFor="prototype-account-search">Find an account</label>
          <input id="prototype-account-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder="Find by name or email" className={`mb-5 w-full max-w-sm rounded-md border bg-transparent px-3 py-2 text-sm ${rule} ${outline}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={`border-b ${rule} ${muted}`}><tr><th scope="col" className="pb-3 pr-6 font-medium">Account</th><th scope="col" className="pb-3 pr-6 font-medium">Role</th><th scope="col" className="pb-3 font-medium">Access</th></tr></thead>
              <tbody>
                {matches.map((user) => (
                  <tr key={user.id} className={`border-b ${rule}`}><td className="py-3 pr-6">{accountName(user)}<span className={`block break-all text-xs ${muted}`}>{user.email}</span></td><td className="pr-6">{roleOf(user)}</td><td>{accessOf(user)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          {matches.length === 0 && <p className={`mt-4 text-sm ${muted}`}>No matching accounts.</p>}
        </>
      )}

      {layout === "inspector" && selected && (
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <ul className={`space-y-1 border-b pb-4 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 ${rule}`}>
            {users.map((user) => <li key={user.id}><button type="button" aria-pressed={user.id === selected.id}
              onClick={() => setSelectedId(user.id)} className={`w-full rounded-md px-3 py-2 text-left text-sm aria-pressed:bg-slate-200 dark:aria-pressed:bg-slate-800 ${outline}`}>{accountName(user)}</button></li>)}
          </ul>
          <section className="sm:pl-3">
            <h2 className="text-xl font-semibold">{selected.name}</h2>
            <p className={`mt-1 break-all text-sm ${muted}`}>{selected.email}</p>
            <dl className={`mt-5 divide-y border-y ${rule} divide-slate-200 dark:divide-slate-800`}>
              <div className="flex justify-between gap-3 py-3 text-sm"><dt className={muted}>Role</dt><dd>{roleOf(selected)}</dd></div>
              <div className="flex justify-between gap-3 py-3 text-sm"><dt className={muted}>Access</dt><dd>{accessOf(selected)}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {layout === "access" && (
        <div className="grid gap-6 sm:grid-cols-2">
          {[false, true].map((suspended) => {
            const group = users.filter((user) => user.suspended === suspended);
            return (
              <section key={String(suspended)} className={`border-t pt-3 ${rule}`}>
                <h2 className="flex justify-between gap-3 font-semibold">{suspended ? "Suspended" : "Active"} <span className={`text-sm font-normal tabular-nums ${muted}`}>{group.length}</span></h2>
                {group.length === 0 ? <p className={`mt-4 text-sm ${muted}`}>No accounts.</p> : (
                  <ul className="mt-2 divide-y divide-slate-200 dark:divide-slate-800">
                    {group.map((user) => <li key={user.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-3 text-sm">
                      <div>{accountName(user)}<span className={`block break-all text-xs ${muted}`}>{user.email}</span></div><span className={`text-xs ${muted}`}>{roleOf(user)}</span>
                    </li>)}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-5 z-40 mx-auto flex w-max items-center gap-3 rounded-full bg-slate-950 px-2 py-1 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-950" aria-label="Layout preview">
        <button type="button" aria-label="Previous layout" onClick={() => cycle(-1)} className={`rounded-full p-2 ${outline}`}><ArrowLeft className="h-4 w-4" /></button>
        <span aria-live="polite">{layouts[index].name} <span className="text-xs opacity-70">· Preview</span></span>
        <button type="button" aria-label="Next layout" onClick={() => cycle(1)} className={`rounded-full p-2 ${outline}`}><ArrowRight className="h-4 w-4" /></button>
      </div>
    </main>
  );
}
