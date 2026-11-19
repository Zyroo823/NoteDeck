import { useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Home, Menu, MessageCircle, Plus, Search, X } from "lucide-react";
import { AppNavigation, type AppNavigationProps } from "@/src/components/AppSidebar";
import { MobileLibrarySearch } from "@/src/components/MobileLibrarySearch";
import { AssistantLauncherContext } from "@/src/chatbot/launcher";

interface MobileNavigationProps extends AppNavigationProps {
  searchQuery: string;
  onOpenPanel: () => void;
  createActions: (close: () => void) => ReactNode;
}

const panels = {
  search: { label: "Search", title: "Search your library", icon: Search },
  create: { label: "Create", title: "Create a study item", icon: Plus },
  menu: { label: "Menu", title: "Menu", icon: Menu },
} as const;

type Panel = keyof typeof panels;
const dockOrder = ["search", "create", "chatbot", "menu"] as const;
const dockButton = "flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold motion-safe:transition-colors active:bg-slate-100 dark:active:bg-[#1C2336]";
const inactive = "text-slate-600 dark:text-slate-400";
const active = "text-indigo-700 dark:text-indigo-300";
const iconPill = "grid h-8 w-14 max-w-full place-items-center rounded-full";

export function MobileNavigation({ folders, foldersFailed, currentPath, onNavigate, searchQuery, onOpenPanel, createActions }: MobileNavigationProps) {
  const assistant = useContext(AssistantLauncherContext);
  const [panel, setPanel] = useState<Panel | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const pathname = new URL(currentPath, "https://notedeck.local").pathname;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!panel || !dialog || dialog.open) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
  }, [panel]);

  useEffect(() => {
    dialogRef.current?.close();
  }, [currentPath]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 48rem)");
    function closeOnDesktop() {
      if (desktop.matches) dialogRef.current?.close();
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function close() {
    dialogRef.current?.close();
  }

  function navigate(path: string) {
    close();
    onNavigate(path);
  }

  return (
    <div className="md:hidden">
      <nav aria-label="Mobile navigation" className="mobile-navigation-dock fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] pl-[max(.5rem,env(safe-area-inset-left))] pr-[max(.5rem,env(safe-area-inset-right))] shadow-[0_-8px_28px_rgba(15,23,42,.06)] backdrop-blur-xl dark:border-slate-800 dark:bg-[#141926]/95 dark:shadow-[0_-8px_28px_rgba(0,0,0,.18)]">
        <div className="mx-auto grid h-[var(--mobile-nav-content-height)] max-w-lg grid-cols-5 items-center gap-1">
          <a href="/" aria-current={pathname === "/" ? "page" : undefined}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
              event.preventDefault();
              if (pathname !== "/") navigate("/");
            }}
            className={`${dockButton} ${pathname === "/" ? active : inactive}`}>
            <span className={`${iconPill} ${pathname === "/" ? "bg-indigo-100 dark:bg-indigo-400/15" : ""}`}><Home aria-hidden="true" className="size-[21px]" /></span>
            Home
          </a>
          {dockOrder.map((key) => {
            if (key === "chatbot") {
              return (
                <button key={key} type="button" aria-haspopup="dialog" aria-expanded={assistant?.isOpen ?? false} aria-controls="notedeck-assistant"
                  onClick={(event) => { onOpenPanel(); assistant?.openFrom(event.currentTarget); }}
                  className={`${dockButton} ${assistant?.isOpen ? active : inactive}`}>
                  <span className={`${iconPill} relative ${assistant?.isOpen ? "bg-indigo-100 dark:bg-indigo-400/15" : ""}`}>
                    <MessageCircle aria-hidden="true" className="size-[21px]" />
                    {assistant?.showHint && <span aria-hidden="true" className="absolute top-1 right-3 size-1.5 rounded-full bg-amber-500 dark:bg-amber-300" />}
                  </span>
                  Chatbot
                </button>
              );
            }
            const { label, icon: Icon } = panels[key];
            const selected = panel === key;
            return (
              <button key={key} type="button" aria-haspopup="dialog" aria-expanded={selected} aria-controls="mobile-navigation-panel"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  onOpenPanel();
                  setPanel(key);
                }}
                className={`${dockButton} ${selected ? active : key === "create" ? "text-slate-900 dark:text-slate-100" : inactive}`}>
                <span className={key === "create"
                  ? "grid size-9 place-items-center rounded-full bg-[#494bd2] text-white"
                  : `${iconPill} ${selected ? "bg-indigo-100 dark:bg-indigo-400/15" : ""}`}>
                  <Icon aria-hidden="true" className={key === "create" ? "size-[22px]" : "size-[21px]"} />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>

      <dialog id="mobile-navigation-panel" ref={dialogRef} aria-labelledby="mobile-navigation-title"
        onClose={() => {
          setPanel(null);
          if (opener.current?.getClientRects().length) opener.current.focus({ preventScroll: true });
        }}
        onClick={(event) => { if (event.target === event.currentTarget) close(); }}
        className={`fixed inset-x-0 m-0 w-full max-w-none text-slate-900 dark:text-slate-100 ${panel === "search"
          ? "inset-y-0 h-dvh max-h-none overflow-hidden bg-slate-50 dark:bg-[#0B0E17]"
          : "top-auto bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-1rem)] overflow-y-auto rounded-t-3xl border border-slate-200 bg-white shadow-2xl backdrop:bg-slate-950/55 dark:border-slate-800 dark:bg-[#141926]"}`}>
        {panel === "search" ? <MobileLibrarySearch initialQuery={searchQuery} onClose={close} onNavigate={navigate} /> : panel && (
          <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="mobile-navigation-title" className="text-lg font-bold tracking-tight">{panels[panel].title}</h2>
              <button type="button" aria-label="Close" data-initial-focus=""
                className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-[#1C2336]" onClick={close}>
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            {panel === "create" && <div className="space-y-1">{createActions(close)}</div>}
            {panel === "menu" && <AppNavigation folders={folders} foldersFailed={foldersFailed} currentPath={currentPath} onNavigate={navigate} hideHome />}
          </div>
        )}
      </dialog>
    </div>
  );
}
