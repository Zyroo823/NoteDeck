import { Bell, Check, ClipboardCheck, Sparkles, TriangleAlert } from "lucide-react";
import type { NotificationInbox } from "@/src/types/api";

interface NotificationsViewProps {
  inbox?: NotificationInbox;
  error?: string;
  saving: boolean;
  onRefresh: () => void;
  onMarkRead: (ids: string[]) => void;
  onOpenSet: (setId: string) => void;
  onOpenGenerate: () => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const actionClass = "inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-300 dark:hover:bg-[#1C2336]";
const icons = { quiz: ClipboardCheck, "generation-saved": Sparkles, "generation-failed": TriangleAlert };

export function NotificationsView({ inbox, error, saving, onRefresh, onMarkRead, onOpenSet, onOpenGenerate }: NotificationsViewProps) {
  const unreadIds = inbox?.notifications.filter(({ read }) => !read).map(({ id }) => id) ?? [];

  return (
    <section aria-labelledby="notifications-heading" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="notifications-heading" className="text-2xl font-bold tracking-tight">Notifications</h1>
          {inbox && <p role="status" className="mt-1 text-sm text-slate-600 dark:text-slate-400">{inbox.unreadCount} unread</p>}
        </div>
        {unreadIds.length > 0 && (
          <button type="button" disabled={saving} onClick={() => onMarkRead(unreadIds)} className={actionClass}>
            <Check aria-hidden="true" className="size-4" /> Mark all as read
          </button>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}{" "}
          {!inbox && <button type="button" onClick={onRefresh} className="ml-1 font-semibold underline">Try again</button>}
        </div>
      )}
      {!inbox && !error && <p role="status" className="text-sm text-slate-600 dark:text-slate-400">Loading notifications…</p>}
      {inbox?.notifications.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-[#141926]">
          <Bell aria-hidden="true" className="mb-3 size-5 text-indigo-600 dark:text-indigo-300" />
          <h2 className="font-semibold">No notifications yet</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Quiz results and AI study activity will appear here.</p>
        </div>
      )}
      {inbox && inbox.notifications.length > 0 && (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-[#141926]">
          {inbox.notifications.map(({ id, kind, title, description, createdAt, read, setId }) => {
            const Icon = icons[kind];
            return (
              <li key={id} className={`flex gap-3 px-4 py-3 ${read ? "" : "bg-indigo-50/70 dark:bg-indigo-400/10"}`}>
                <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-indigo-600 dark:text-indigo-300" />
                <div className="min-w-0 flex-1">
                  <h2 className="flex items-center gap-2 text-sm font-semibold">
                    {title}
                    {!read && <span className="size-2 rounded-full bg-indigo-600 dark:bg-indigo-300"><span className="sr-only">Unread</span></span>}
                  </h2>
                  <p className="mt-1 break-words text-sm text-slate-700 dark:text-slate-300">{description}</p>
                  <time dateTime={createdAt} className="mt-1 block text-xs text-slate-600 dark:text-slate-400">
                    {dateFormat.format(new Date(createdAt))}
                  </time>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {setId && <button type="button" onClick={() => onOpenSet(setId)} className={actionClass}>Open set</button>}
                    {kind === "generation-failed" && <button type="button" onClick={onOpenGenerate} className={actionClass}>Generate again</button>}
                    {!read && (
                      <button type="button" disabled={saving} onClick={() => onMarkRead([id])} className={actionClass}>Mark as read</button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
