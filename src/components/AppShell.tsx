import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  ClipboardCheck,
  Folder,
  Layers,
  LogOut,
  Moon,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import type { AuthUser, FolderSummary } from "@/src/types/api";
import { AppSidebar } from "@/src/components/AppSidebar";

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
  children,
}: AppShellProps) {
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [navigationOpen, setNavigationOpen] = useState(false);

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

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = searchInput.trim();
    onNavigate(trimmed ? `/library?q=${encodeURIComponent(trimmed)}` : "/library");
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
          aria-label="Open navigation"
          aria-controls="mobile-sidebar"
          aria-expanded={navigationOpen}
          aria-haspopup="dialog"
          onClick={() => {
            setNavigationOpen(true);
            setCreateOpen(false);
            setProfileOpen(false);
          }}
          className="grid size-11 shrink-0 place-items-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden dark:text-slate-200 dark:hover:bg-[#1C2336]"
        >
          <PanelLeftOpen aria-hidden="true" className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => onNavigate("/")}
          aria-label="Go to NoteDeck Home"
          className="hidden items-center gap-2.5 rounded-xl py-1.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] sm:flex"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#494bd2] text-white">
            <BookOpen className="h-4 w-4" />
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:inline">NoteDeck</span>
        </button>

        <form onSubmit={handleSearchSubmit} className="min-w-0 max-w-xl flex-1">
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
          <div className="relative" ref={createRef}>
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
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCreateOpen(false);
                    onNavigate("/sets/new");
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-[#1C2336]"
                >
                  <Layers className="h-4 w-4 text-[#5B6CFA]" />
                  Flashcard set
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setCreateOpen(false);
                    onOpenGenerate();
                  }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-[#1C2336]"
                >
                  <Sparkles className="h-4 w-4 text-[#2DD4BF]" />
                  Generate with AI
                </button>

                <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                <button type="button" role="menuitem" onClick={() => {
                  setCreateOpen(false);
                  onNavigate("/practice-test");
                }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-[#1C2336]">
                  <ClipboardCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[#5B6CFA]" />
                  Practice test
                </button>

                <button type="button" role="menuitem" onClick={() => {
                  setCreateOpen(false);
                  onNavigate("/folders/new");
                }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition hover:bg-slate-100 dark:hover:bg-[#1C2336]">
                  <Folder aria-hidden="true" className="h-4 w-4 shrink-0 text-[#5B6CFA]" />
                  Folder
                </button>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((prev) => !prev);
                setCreateOpen(false);
              }}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-200 text-sm font-bold text-slate-800 transition hover:border-[#5B6CFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-700 dark:bg-[#1C2336] dark:text-slate-100"
            >
              {initialLetter}
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
        <AppSidebar key={user.id} folders={folders} foldersFailed={foldersFailed} currentPath={currentPath}
          mobileOpen={navigationOpen} onMobileClose={() => setNavigationOpen(false)} onNavigate={onNavigate} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 focus-visible:outline-none sm:px-6 lg:px-10">
          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </main>
      </div>
      <footer className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-slate-200 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
        <a href="/privacy" className="hover:underline focus-visible:underline">Privacy Policy</a>
        <a href="/terms" className="hover:underline focus-visible:underline">Terms of Service</a>
        <a href="/cookies" className="hover:underline focus-visible:underline">Cookie Policy</a>
      </footer>
    </div>
  );
}
