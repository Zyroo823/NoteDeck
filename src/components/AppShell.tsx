import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Bell,
  ClipboardCheck,
  FileLock2,
  Folder,
  Layers,
  LifeBuoy,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import type { AuthUser, FolderSummary } from "@/src/types/api";
import { AppSidebar } from "@/src/components/AppSidebar";
import { MobileNavigation } from "@/src/components/MobileNavigation";

interface AppShellProps {
  user: AuthUser;
  folders?: FolderSummary[];
  foldersFailed?: boolean;
  currentPath: string;
  searchQuery: string;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onNavigate: (path: string) => void;
  onOpenGenerate: () => void;
  onLogout: () => void;
  unreadNotifications: number;
  onRefreshNotifications: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  folders,
  foldersFailed,
  currentPath,
  searchQuery,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenGenerate,
  onLogout,
  unreadNotifications,
  onRefreshNotifications,
  children,
}: AppShellProps) {
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const createRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setCreateOpen(false);
    setProfileOpen(false);
  }, [currentPath]);

  useEffect(() => {
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (createRef.current && !createRef.current.contains(target)) {
        setCreateOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  function searchLibrary(query: string) {
    const trimmed = query.trim();
    onNavigate(trimmed ? `/library?q=${encodeURIComponent(trimmed)}` : "/library");
  }

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchLibrary(searchInput);
  }

  function createActions(close: () => void, desktop = false) {
    const actions = [
      { label: "Flashcard set", icon: Layers, run: () => onNavigate("/sets/new") },
      { label: "Generate with AI", icon: Sparkles, run: onOpenGenerate },
      { label: "Practice test", icon: ClipboardCheck, run: () => onNavigate("/practice-test") },
      { label: "Folder", icon: Folder, run: () => onNavigate("/folders/new") },
    ];

    return actions.map(({ label, icon: Icon, run }) => (
      <button key={label} type="button" role={desktop ? "menuitem" : undefined}
        onClick={() => { close(); run(); }}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-[#1C2336]">
        <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${Icon === Sparkles ? "text-teal-600 dark:text-[#2DD4BF]" : "text-[#5B6CFA]"}`} />
        {label}
      </button>
    ));
  }

  const initialLetter = user.name.trim().slice(0, 1).toUpperCase() || "S";

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-slate-900 focus:shadow-lg">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 backdrop-blur sm:gap-4 sm:px-4 dark:border-slate-800 dark:bg-[#0B0E17]/95">
        <button
          type="button"
          onClick={() => onNavigate("/")}
          aria-label="Go to NoteDeck Home"
          className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-xl py-1.5 text-left whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA]"
        >
          <img src="/favicon.svg" alt="" width={32} height={32} className="size-8" />
          <span className="text-base font-bold tracking-tight">NoteDeck</span>
        </button>

        <form onSubmit={handleSearchSubmit} className="hidden min-w-0 max-w-xl flex-1 md:block">
          <label htmlFor="top-search-library" className="sr-only">
            Search your library
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="top-search-library"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search your library"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 pl-9 pr-2 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] max-[360px]:placeholder:text-xs sm:pl-10 sm:pr-4 dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <div className="relative hidden md:block" ref={createRef}>
            <button
              type="button"
              onClick={() => {
                setCreateOpen((prev) => !prev);
                setProfileOpen(false);
              }}
              aria-label="Create new study item"
              aria-expanded={createOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#494bd2] text-white transition hover:bg-[#4B5CE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0E17]"
            >
              <Plus className="h-5 w-5" />
            </button>

            {createOpen ? (
              <div
                role="menu"
                aria-label="Create menu"
                className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-800 dark:bg-[#141926]"
              >
                {createActions(() => setCreateOpen(false), true)}
              </div>
            ) : null}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setCreateOpen(false);
                if (!profileOpen) onRefreshNotifications();
              }}
              aria-label={unreadNotifications ? `Open profile menu, ${unreadNotifications} unread notifications` : "Open profile menu"}
              aria-expanded={profileOpen}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-sm font-bold text-slate-800 transition hover:border-[#5B6CFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#1C2336] dark:text-slate-100"
            >
              {initialLetter}
              {unreadNotifications > 0 && <span aria-hidden="true" className="absolute right-0 top-0 size-2.5 rounded-full border border-white bg-indigo-600 dark:border-[#1C2336] dark:bg-indigo-300" />}
            </button>

            {profileOpen ? (
              <div
                role="menu"
                aria-label="Profile menu"
                className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-[#141926]"
              >
                <div className="border-b border-slate-200 px-3 py-2.5 dark:border-slate-800">
                  <p className="truncate text-sm font-semibold">{user.name}</p>
                  <p className="truncate text-xs text-slate-600 dark:text-slate-400">{user.email}</p>
                </div>

                <div className="py-1">
                  {user.role === "admin" && (
                    <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onNavigate("/admin"); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]">
                      <ShieldCheck className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                      Manage Users
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate("/settings");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]"
                  >
                    <Settings className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    Settings
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={onToggleTheme}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]"
                  >
                    {theme === "dark" ? (
                      <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Moon className="h-4 w-4 text-slate-600" />
                    )}
                    {theme === "dark" ? "Light mode" : "Dark mode"}
                  </button>
                </div>

                <div role="group" aria-label="Notifications, privacy and support" className="border-t border-slate-200 py-1 dark:border-slate-800">
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onNavigate("/notifications"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]">
                    <Bell aria-hidden="true" className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    Notifications
                    {unreadNotifications > 0 && (
                      <span className="ml-auto rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-400/15 dark:text-indigo-200">
                        {unreadNotifications}<span className="sr-only"> unread</span>
                      </span>
                    )}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onNavigate("/privacy"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]">
                    <FileLock2 aria-hidden="true" className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    Privacy Policy
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setProfileOpen(false); onNavigate("/help"); }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]">
                    <LifeBuoy aria-hidden="true" className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                    Help and Feedback
                  </button>
                </div>

                <div className="border-t border-slate-200 pt-1 dark:border-slate-800">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        <AppSidebar key={user.id} folders={folders} foldersFailed={foldersFailed} currentPath={currentPath} onNavigate={onNavigate} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus-visible:outline-none sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <a href="/privacy" className="hover:underline focus-visible:underline">Privacy Policy</a>
        <a href="/terms" className="hover:underline focus-visible:underline">Terms of Service</a>
        <a href="/cookies" className="hover:underline focus-visible:underline">Cookie Policy</a>
      </footer>
      <MobileNavigation folders={folders} foldersFailed={foldersFailed} currentPath={currentPath} onNavigate={onNavigate}
        searchQuery={searchQuery} createActions={createActions}
        onOpenPanel={() => { setCreateOpen(false); setProfileOpen(false); }} />
    </div>
  );
}
