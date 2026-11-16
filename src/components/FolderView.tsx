import { useEffect, useState, type FormEvent } from "react";
import { FileText, Folder, Layers, Pencil, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/src/components/ConfirmDialog";
import { folderNameSchema } from "@/src/lib/schemas";
import type { FolderSummary, LibraryGuideSummary, LibrarySetSummary } from "@/src/types/api";

interface FolderViewProps {
  folder?: FolderSummary;
  onNavigate: (path: string) => void;
  onSaved: (folder: FolderSummary) => void;
  onDeleted: (id: string) => void;
}

interface FolderItem {
  kind: "set" | "guide";
  id: string;
  title: string;
  folderId: string | null;
}

const panel = "rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-[#141926]";
const field = "h-11 min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm focus-visible:outline-2 focus-visible:outline-indigo-500 dark:border-slate-700 dark:bg-[#0B0E17]";
const primary = "rounded-xl bg-[#494bd2] px-4 py-2.5 text-sm font-semibold whitespace-nowrap text-white hover:bg-[#4B5CE8] disabled:opacity-50";
const secondary = "inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-[#1C2336]";

export function FolderView({ folder, onNavigate, onSaved, onDeleted }: FolderViewProps) {
  const folderId = folder?.id;
  const [name, setName] = useState(folder?.name ?? "");
  const [editing, setEditing] = useState(!folder);
  const [items, setItems] = useState<FolderItem[] | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!folderId) return;
    const controller = new AbortController();
    async function loadItems() {
      try {
        const res = await fetch("/api/library", { signal: controller.signal });
        if (!res.ok) throw new Error();
        const { sets, guides } = (await res.json()) as {
          sets: LibrarySetSummary[];
          guides: LibraryGuideSummary[];
        };
        if (!controller.signal.aborted) {
          setItems([
            ...sets.map((set) => ({ ...set, kind: "set" as const })),
            ...guides.map((guide) => ({ ...guide, kind: "guide" as const })),
          ]);
        }
      } catch {
        if (!controller.signal.aborted) setLoadError("Could not load your study items. Reopen the folder to retry.");
      }
    }
    void loadItems();
    return () => controller.abort();
  }, [folderId]);

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = folderNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await fetch(folderId ? `/api/folders/${folderId}` : "/api/folders", {
        method: folderId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: parsed.data }),
      });
      const result = (await res.json()) as { folder?: FolderSummary; error?: string };
      if (!res.ok || !result.folder) throw new Error(result.error ?? "Could not save the folder.");
      onSaved(result.folder);
      setEditing(false);
      if (!folderId) onNavigate(`/folders/${result.folder.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the folder.");
    } finally {
      setBusy(false);
    }
  }

  async function changeMembership(item: FolderItem, add: boolean) {
    if (!folderId) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${folderId}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: item.kind, id: item.id, add }),
      });
      const result = (await res.json()) as { folderId: string | null; error?: string };
      if (!res.ok) throw new Error(result.error ?? "Could not update the folder.");
      setItems((current) => current?.map((entry) =>
        entry.kind === item.kind && entry.id === item.id
          ? { ...entry, folderId: result.folderId }
          : entry
      ) ?? null);
      if (add) setSelected("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the folder.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFolder() {
    if (!folderId) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/folders/${folderId}`, { method: "DELETE" });
      if (!res.ok) {
        const result = (await res.json()) as { error?: string };
        throw new Error(result.error ?? "Could not delete the folder.");
      }
      onDeleted(folderId);
      onNavigate("/library");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the folder.");
    } finally {
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  const contents = items?.filter((item) => item.folderId === folderId) ?? [];
  const available = items?.filter((item) => !item.folderId) ?? [];
  const selectedItem = available.find((item) => `${item.kind}:${item.id}` === selected);

  return (
    <section className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-3 text-2xl font-bold tracking-tight">
          <Folder aria-hidden="true" className="size-6 shrink-0 text-[#5B6CFA]" />
          <span className="wrap-anywhere">{folder?.name ?? "New folder"}</span>
        </h1>
        {folder && (
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={busy} className={secondary} onClick={() => {
              setName(folder.name);
              setEditing(true);
              setError("");
            }}>
              <Pencil aria-hidden="true" className="size-4" /> Rename
            </button>
            <button type="button" disabled={busy} className={secondary} onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden="true" className="size-4" /> Delete folder
            </button>
          </div>
        )}
      </div>

      {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}

      {editing && (
        <form className={panel} onSubmit={saveName}>
          <label htmlFor="folder-name" className="mb-2 block text-sm font-medium">Folder name</label>
          <div className="flex flex-wrap gap-2">
            <input id="folder-name" autoFocus required maxLength={80} value={name}
              onChange={(event) => setName(event.target.value)} className={`${field} flex-1`} />
            <button type="submit" className={primary} disabled={busy || !name.trim()}>
              {folder ? "Save name" : "Create folder"}
            </button>
            <button type="button" className={secondary} disabled={busy} onClick={() => {
              if (folder) {
                setEditing(false);
                setError("");
              } else {
                onNavigate("/library");
              }
            }}>Cancel</button>
          </div>
        </form>
      )}

      {folder && (
        <div className={panel}>
          {loadError ? (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">{loadError}</p>
          ) : items === null ? (
            <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading study items…</p>
          ) : (
            <>
              {contents.length ? (
                <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                  {contents.map((item) => {
                    const Icon = item.kind === "set" ? Layers : FileText;
                    return (
                      <li key={`${item.kind}:${item.id}`} className="flex items-center gap-2 py-2">
                        <button type="button" onClick={() => onNavigate(`/${item.kind === "set" ? "sets" : "guides"}/${item.id}`)}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-2 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#1C2336]">
                          <Icon aria-hidden="true" className="size-4 shrink-0 text-[#5B6CFA]" />
                          <span className="truncate">{item.title}</span>
                        </button>
                        <button type="button" disabled={busy} aria-label={`Remove ${item.title} from folder`}
                          onClick={() => void changeMembership(item, false)}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-[#1C2336]">
                          <X aria-hidden="true" className="size-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 dark:text-slate-300">This folder is empty.</p>
              )}
              {available.length ? (
                <form className="mt-5" onSubmit={(event) => {
                  event.preventDefault();
                  if (selectedItem) void changeMembership(selectedItem, true);
                }}>
                  <label htmlFor="folder-item" className="mb-2 block text-sm font-medium">Add from your library</label>
                  <div className="flex flex-wrap gap-2">
                    <select id="folder-item" value={selected} onChange={(event) => setSelected(event.target.value)}
                      className={`${field} flex-1`}>
                      <option value="">Choose a set or guide</option>
                      {available.map((item) => (
                        <option key={`${item.kind}:${item.id}`} value={`${item.kind}:${item.id}`}>
                          {item.title} — {item.kind === "set" ? "Flashcards" : "Study guide"}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={!selectedItem || busy} className={primary}>Add to folder</button>
                  </div>
                </form>
              ) : (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No unfiled study items to add.</p>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Delete folder"
        message={`Delete “${folder?.name ?? ""}”? Its flashcards and guides will stay in your library.`}
        confirmLabel="Delete folder"
        loading={busy}
        onConfirm={() => void deleteFolder()}
        onCancel={() => setConfirmDelete(false)}
      />
    </section>
  );
}
