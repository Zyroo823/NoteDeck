import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { FileText, Home, Layers, Library, PanelLeftOpen, X } from "lucide-react";

interface RecentItem {
  path: string;
  title: string;
}

interface AppSidebarProps {
  userId: string;
  currentPath: string;
  onNavigate: (path: string) => void;
}

const studyItemPath = /^\/(sets|guides)\/[^/?#]+$/;
const sidebarSurface = "border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131826]";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";
const navItem = "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium";
const sectionLabel = "mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400";

function readRecentItems(key: string): RecentItem[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is RecentItem =>
      typeof item?.path === "string" && studyItemPath.test(item.path) && item.path !== "/sets/new" &&
      typeof item.title === "string"
    ).slice(0, 3);
  } catch {
    return [];
  }
}

export function AppSidebar({ userId, currentPath, onNavigate }: AppSidebarProps) {
  const storageKey = `notedeck-recent-opened:${userId}`;
  const [recent, setRecent] = useState(() => readRecentItems(storageKey));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const { pathname, searchParams } = new URL(currentPath, window.location.origin);
  const libraryType = searchParams.get("type");
  const activePath = pathname === "/library" && (libraryType === "sets" || libraryType === "guides")
    ? `/library?type=${libraryType}`
    : pathname;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(recent));
    } catch {
      // Keep the current session usable when browser storage is unavailable.
    }
  }, [recent, storageKey]);

  useEffect(() => {
    const kind = pathname.match(studyItemPath)?.[1];
    if (!kind || pathname === "/sets/new") return;
    const controller = new AbortController();
    async function recordOpenedItem() {
      try {
        const response = await fetch(`/api${pathname}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 404) {
          setRecent((items) => items.filter((item) => item.path !== pathname));
          return;
        }
        if (!response.ok) return;
        const detail = await response.json();
        const title = (kind === "sets" ? detail.set : detail.guide)?.title;
        if (typeof title !== "string" || controller.signal.aborted) return;
        setRecent((items) => [
          { path: pathname, title },
          ...items.filter((item) => item.path !== pathname),
        ].slice(0, 3));
      } catch {
        // Recent history is optional and should never block navigation.
      }
    }
    void recordOpenedItem();
    return () => controller.abort();
  }, [pathname, userId]);

  useEffect(() => {
    drawer.current?.close();
  }, [currentPath]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    function handleResize() {
      if (desktop.matches) drawer.current?.close();
    }
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, []);

  function navigate(event: MouseEvent<HTMLAnchorElement>, path: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey ||
        event.shiftKey || event.altKey) return;
    event.preventDefault();
    drawer.current?.close();
    onNavigate(path);
  }

  function navLink(path: string, label: string, icon: ReactNode) {
    const active = activePath === path;
    return (
      <a href={path} onClick={(event) => navigate(event, path)} aria-current={active ? "page" : undefined}
        title={label}
        className={`${navItem} ${focusRing} overflow-hidden transition-colors duration-150 ${
          active
            ? "bg-indigo-500/15 text-indigo-700 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-indigo-500 dark:text-indigo-300"
            : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
        }`}>
        {icon}
        <span className="min-w-0 truncate">{label}</span>
      </a>
    );
  }

  const iconClass = "size-4 shrink-0";
  const navigation = (
    <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <ul className="space-y-0.5">
          <li>{navLink("/", "Home", <Home aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/library", "Your library", <Library aria-hidden="true" className={iconClass} />)}</li>
        </ul>
      </div>
      <div>
        <h2 className={sectionLabel}>Study</h2>
        <ul className="space-y-0.5">
          <li>{navLink("/library?type=sets", "Flashcards", <Layers aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/library?type=guides", "Study Guides", <FileText aria-hidden="true" className={iconClass} />)}</li>
        </ul>
      </div>
      <div>
        <h2 className={sectionLabel}>Recent</h2>
        {recent.length > 0 ? (
          <ul className="space-y-0.5">
            {recent.map(({ path, title }) => (
              <li key={path}>{navLink(path, title, path.startsWith("/sets/")
                ? <Layers aria-hidden="true" className={iconClass} />
                : <FileText aria-hidden="true" className={iconClass} />)}</li>
            ))}
          </ul>
        ) : (
          <p className="px-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">Opened decks and guides appear here.</p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <aside className={`sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 self-start overflow-y-auto border-r p-3 md:flex md:flex-col ${sidebarSurface}`}>
        {navigation}
      </aside>
      <div className={`fixed inset-x-0 bottom-0 z-20 flex justify-center border-t px-3 pb-[env(safe-area-inset-bottom)] md:hidden ${sidebarSurface}`}>
        <button type="button" aria-controls="mobile-sidebar" aria-expanded={drawerOpen} aria-haspopup="dialog"
          className={`flex min-h-12 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-indigo-700 dark:text-indigo-300 ${focusRing}`}
          onClick={() => {
            const dialog = drawer.current;
            if (!dialog || dialog.open) return;
            dialog.showModal();
            setDrawerOpen(true);
          }}>
          <PanelLeftOpen aria-hidden="true" className="size-4" /> Browse
        </button>
      </div>
      <dialog id="mobile-sidebar" ref={drawer} aria-labelledby="mobile-sidebar-title"
        onClose={() => setDrawerOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
        className={`fixed top-16 left-0 m-0 h-[calc(100dvh-4rem)] max-h-none w-60 max-w-[90vw] -translate-x-full overflow-y-auto border-r text-inherit transition-[translate,display,overlay] duration-200 [transition-behavior:allow-discrete] open:translate-x-0 starting:open:-translate-x-full backdrop:bg-black/50 motion-reduce:transition-none md:hidden ${sidebarSurface}`}>
        <div className="flex min-h-full flex-col px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between pl-3">
            <h2 id="mobile-sidebar-title" className="text-sm font-semibold">Browse</h2>
            <button type="button" autoFocus aria-label="Close navigation"
              className={`grid size-10 place-items-center rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 ${focusRing}`}
              onClick={() => drawer.current?.close()}><X aria-hidden="true" className="size-4" /></button>
          </div>
          {navigation}
        </div>
      </dialog>
    </>
  );
}
