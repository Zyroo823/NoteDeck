import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { Activity, ClipboardCheck, FileText, Folder, Gamepad2, Home, Layers, UsersRound, X } from "lucide-react";
import type { FolderSummary } from "@/src/types/api";

interface AppSidebarProps {
  folders?: FolderSummary[];
  foldersFailed?: boolean;
  currentPath: string;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onNavigate: (path: string) => void;
}

const sidebarSurface = "border-slate-200 bg-white dark:border-slate-800 dark:bg-[#131826]";
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500";
const navItem = "relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium";
const sectionLabel = "mb-1.5 px-3 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400";
const soonBadge = "ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 dark:bg-[#1C2336] dark:text-slate-300";

export function AppSidebar({ folders, foldersFailed, currentPath, mobileOpen, onMobileClose, onNavigate }: AppSidebarProps) {
  const drawer = useRef<HTMLDialogElement>(null);
  const url = new URL(currentPath, window.location.origin);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const { searchParams } = url;
  const libraryType = searchParams.get("type");
  const activePath = pathname === "/library" && (libraryType === "sets" || libraryType === "guides" || libraryType === "activities")
    ? `/library?type=${libraryType}`
    : pathname.startsWith("/study-groups/") ? "/study-groups" : pathname;

  useEffect(() => {
    drawer.current?.close();
  }, [currentPath]);

  useEffect(() => {
    const dialog = drawer.current;
    if (mobileOpen && !dialog?.open) dialog?.showModal();
    if (!mobileOpen && dialog?.open) dialog.close();
  }, [mobileOpen]);

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

  function comingSoon(label: string, icon: ReactNode) {
    return (
      <span className={`${navItem} text-slate-500 dark:text-slate-400`}>
        {icon}
        <span>{label}</span>
        <span className={soonBadge}>Soon</span>
      </span>
    );
  }

  function navLink(path: string, label: string, icon: ReactNode, badge?: string) {
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
        {badge && <span className={soonBadge}>{badge}</span>}
      </a>
    );
  }

  const iconClass = "size-4 shrink-0";
  const navigation = (
    <nav aria-label="Primary navigation" className="flex min-h-0 flex-1 flex-col gap-6">
      <div>
        <ul className="space-y-0.5">
          <li>{navLink("/", "Home", <Home aria-hidden="true" className={iconClass} />)}</li>
          <li>{comingSoon("Games", <Gamepad2 aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/study-groups", "Study groups", <UsersRound aria-hidden="true" className={iconClass} />)}</li>
        </ul>
      </div>
      <div>
        <h2 className="mb-1.5 px-3 text-xs font-semibold text-slate-600 dark:text-slate-400">
          <a href="/library" onClick={(event) => navigate(event, "/library")}
            aria-current={activePath === "/library" ? "page" : undefined} className="rounded-sm hover:underline">
            Your Library
          </a>
        </h2>
        <ul className="space-y-0.5">
          <li>{navLink("/library?type=sets", "Flashcards", <Layers aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/library?type=guides", "Study guides", <FileText aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/practice-test", "Practice Test", <ClipboardCheck aria-hidden="true" className={iconClass} />)}</li>
          <li>{navLink("/library?type=activities", "Activities", <Activity aria-hidden="true" className={iconClass} />, "Soon")}</li>
        </ul>
      </div>
      <div>
        <h2 className={sectionLabel}>Folders</h2>
        {folders?.length ? (
          <ul className="space-y-0.5">
            {[...folders].sort((a, b) => a.name.localeCompare(b.name)).map(({ id, name }) => (
              <li key={id}>{navLink(`/folders/${id}`, name, <Folder aria-hidden="true" className={iconClass} />)}</li>
            ))}
          </ul>
        ) : (
          <p className="px-3 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {foldersFailed ? "Could not load folders." : folders ? "No folders yet." : "Loading folders…"}
          </p>
        )}
      </div>
    </nav>
  );

  return (
    <>
      <aside className={`sticky top-16 hidden max-h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r p-3 md:flex md:flex-col ${sidebarSurface}`}>
        {navigation}
      </aside>
      <dialog id="mobile-sidebar" ref={drawer} aria-labelledby="mobile-sidebar-title"
        onClose={onMobileClose}
        onClick={(event) => {
          if (event.target === event.currentTarget) drawer.current?.close();
        }}
        className={`fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-64 max-w-[90vw] -translate-x-full overflow-y-auto border-r text-inherit transition-[translate,display,overlay] duration-200 [transition-behavior:allow-discrete] open:translate-x-0 starting:open:-translate-x-full backdrop:bg-black/50 motion-reduce:transition-none md:hidden ${sidebarSurface}`}>
        <div className="flex min-h-full flex-col px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mb-3 flex items-center justify-between pl-3">
            <h2 id="mobile-sidebar-title" className="text-sm font-semibold">Navigation</h2>
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
