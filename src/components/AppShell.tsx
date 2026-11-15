import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Folder,
  Home,
  Layers,
  Library,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import type { AuthUser } from "@/src/types/api";

interface AppShellProps {
  user: AuthUser;
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
  currentPath,
  searchQuery,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenGenerate,
  onLogout,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [createOpen, setCreateOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const createRef = useRef<HTMLDivElement | null>(null);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    setMobileOpen(false);
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
        setMobileOpen(false);
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
  const isHome = currentPath === "/";
  const isLibraryAll = currentPath === "/library";
  const isLibrarySets = currentPath === "/library?type=sets";
  const isLibraryGuides = currentPath === "/library?type=guides";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#0B0E17] dark:text-slate-100">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur dark:border-slate-800 dark:bg-[#0B0E17]/95">
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (window.innerWidth < 768) {
                setMobileOpen((prev) => !prev);
              } else {
                setDesktopCollapsed((prev) => !prev);
              }
            }}
            aria-label="Toggle navigation sidebar"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:text-slate-300 dark:hover:bg-[#1C2336]"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate("/")}
            aria-label="Go to NoteDeck Home"
            className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA]"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5B6CFA] text-white">
              <BookOpen className="h-4 w-4" />
            </span>
            <span className="hidden text-base font-bold tracking-tight sm:inline">NoteDeck</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="max-w-xl flex-1">
          <label htmlFor="top-search-library" className="sr-only">
            Search your library
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="top-search-library"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search your library"
              className="h-10 w-full rounded-full border border-slate-200 bg-slate-100 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] dark:border-slate-800 dark:bg-[#141926] dark:text-slate-100 dark:placeholder:text-slate-400"
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
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#5B6CFA] text-white transition hover:bg-[#4B5CE8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5B6CFA] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B0E17]"
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
                  Study guide
                </button>

                <div className="my-1 border-t border-slate-200 dark:border-slate-800" />

                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400">
                  <span className="flex items-center gap-3">
                    <ClipboardCheck className="h-4 w-4" />
                    Practice test
                  </span>
                  <span className="text-xs text-slate-400">Phase 2</span>
                </div>

                <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-400">
                  <span className="flex items-center gap-3">
                    <Folder className="h-4 w-4" />
                    Folder
                  </span>
                  <span className="text-xs text-slate-400">Phase 2</span>
                </div>
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
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                </div>

                <div className="py-1">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileOpen(false);
                      onNavigate("/settings");
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#1C2336]"
                  >
                    <Settings className="h-4 w-4 text-slate-500 dark:text-slate-400" />
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

      <div className="flex min-h-[calc(100vh-4rem)]">
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        ) : null}

        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-slate-200 bg-white p-4 transition-transform dark:border-slate-800 dark:bg-[#0B0E17] md:static md:z-auto ${
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          } ${desktopCollapsed ? "md:hidden" : "md:block"}`}
        >
          <div className="mb-4 flex items-center justify-between md:hidden">
            <span className="text-base font-bold">NoteDeck</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation sidebar"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1C2336]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav aria-label="Primary navigation" className="space-y-6">
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => onNavigate("/")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition ${
                  isHome
                    ? "bg-[#5B6CFA]/15 text-[#5B6CFA]"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#141926]"
                }`}
              >
                <Home className="h-4 w-4 shrink-0" />
                Home
              </button>

              <button
                type="button"
                onClick={() => onNavigate("/library")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition ${
                  isLibraryAll
                    ? "bg-[#5B6CFA]/15 text-[#5B6CFA]"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#141926]"
                }`}
              >
                <Library className="h-4 w-4 shrink-0" />
                Your library
              </button>
            </div>

            <div>
              <p className="mb-2 px-3 text-xs font-semibold text-slate-400">Start here</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => onNavigate("/library?type=sets")}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition ${
                    isLibrarySets
                      ? "bg-[#5B6CFA]/15 text-[#5B6CFA]"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#141926]"
                  }`}
                >
                  <Layers className="h-4 w-4 shrink-0 text-[#5B6CFA]" />
                  Flashcards
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate("/library?type=guides")}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium whitespace-nowrap transition ${
                    isLibraryGuides
                      ? "bg-[#2DD4BF]/15 text-[#2DD4BF]"
                      : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#141926]"
                  }`}
                >
                  <FileText className="h-4 w-4 shrink-0 text-[#2DD4BF]" />
                  Study Guides
                </button>

                <div className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400">
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    <ClipboardCheck className="h-4 w-4 shrink-0" />
                    Practice Tests
                  </span>
                  <span className="text-xs text-slate-500">Phase 2</span>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
