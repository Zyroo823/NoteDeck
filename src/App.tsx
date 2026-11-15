import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthScreen } from "@/src/components/AuthScreen";
import { AppShell } from "@/src/components/AppShell";
import { HomeView } from "@/src/components/HomeView";
import { LandingPage } from "@/src/components/LandingPage";
import { LibraryView } from "@/src/components/LibraryView";
import { SetFormView } from "@/src/components/SetFormView";
import { StudySetView } from "@/src/components/StudySetView";
import { StudyGuideView } from "@/src/components/StudyGuideView";
import { SettingsView } from "@/src/components/SettingsView";
import { AdminView } from "@/src/components/AdminView";
import { GenerateModal } from "@/src/components/GenerateModal";
import { FolderView } from "@/src/components/FolderView";
import { PracticeTestView } from "@/src/components/PracticeTestView";
import type { AuthUser, FolderSummary } from "@/src/types/api";

function getInitialTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem("notedeck-theme") === "light" ? "light" : "dark";
}

function readCurrentUrlPath(): string {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}`;
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [currentPath, setCurrentPath] = useState<string>(readCurrentUrlPath);
  const [authMode, setAuthMode] = useState<"login" | "signup">(() =>
    readCurrentUrlPath().startsWith("/signup") ? "signup" : "login"
  );
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [folderList, setFolderList] = useState<{
    userId: string;
    folders: FolderSummary[];
    failed?: boolean;
  } | null>(null);
  const [folderRetry, setFolderRetry] = useState(0);
  const userId = user?.id;

  const navigate = useCallback((nextPath: string) => {
    window.history.pushState({}, "", nextPath);
    setCurrentPath(nextPath);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    function handlePopState() {
      const next = readCurrentUrlPath();
      setCurrentPath(next);
      if (next.startsWith("/signup")) setAuthMode("signup");
      if (next.startsWith("/login")) setAuthMode("login");
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    window.localStorage.setItem("notedeck-theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;
    async function hydrateUser() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (active) setUser(null);
          return;
        }
        const data = (await res.json()) as { user?: AuthUser };
        if (active && data.user) {
          setUser(data.user);
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setCheckingAuth(false);
      }
    }
    void hydrateUser();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    async function loadFolders(ownerId: string) {
      try {
        const response = await fetch("/api/folders", { signal: controller.signal });
        if (!response.ok) throw new Error();
        const { folders } = (await response.json()) as { folders: FolderSummary[] };
        if (!controller.signal.aborted) setFolderList({ userId: ownerId, folders });
      } catch {
        if (!controller.signal.aborted) setFolderList({ userId: ownerId, folders: [], failed: true });
      }
    }
    void loadFolders(userId);
    return () => controller.abort();
  }, [userId, folderRetry]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setFolderList(null);
    setAuthMode("login");
    navigate("/");
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0B0E17]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B6CFA]"/>
      </div>
    );
  }

  const parsedUrl = new URL(currentPath, "http://localhost");
  const pathname = parsedUrl.pathname;

  if (!user && pathname === "/") return <LandingPage theme={theme} onToggleTheme={toggleTheme} />;

  if (!user) {
    return (
      <AuthScreen
        mode={authMode}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSwitchMode={(nextMode) => {
          setAuthMode(nextMode);
          navigate(nextMode === "signup" ? "/signup" : "/login");
        }}
        onAuthenticated={(authedUser) => {
          setUser(authedUser);
          if (currentPath.startsWith("/login") || currentPath.startsWith("/signup")) {
            navigate("/");
          }
        }}
      />
    );
  }

  const searchQuery = parsedUrl.searchParams.get("q") ?? "";
  const typeParam = parsedUrl.searchParams.get("type");
  const modeParam = parsedUrl.searchParams.get("mode");
  const currentFolders = folderList?.userId === user.id ? folderList : null;

  function renderMainRoute() {
    if (pathname === "/library") {
      const initialTab =
        typeParam === "sets" ? "sets" : typeParam === "guides" ? "guides" : "all";
      return (
        <LibraryView
          initialQuery={searchQuery}
          initialTab={initialTab}
          onNavigate={navigate}
          onOpenGenerate={() => setGenerateOpen(true)}
        />
      );
    }

    if (pathname === "/sets/new") {
      return <SetFormView mode="create" onNavigate={navigate} />;
    }

    if (pathname === "/practice-test") {
      return <PracticeTestView onNavigate={navigate} />;
    }

    const folderMatch = pathname.match(/^\/folders\/([^/]+)$/);
    if (folderMatch) {
      if (!currentFolders) {
        return <p role="status" className="text-sm text-slate-500 dark:text-slate-400">Loading folders…</p>;
      }
      if (currentFolders.failed) {
        return (
          <div className="space-y-2 text-sm">
            <p role="alert">Could not load your folders.</p>
            <button type="button" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300"
              onClick={() => {
                setFolderList(null);
                setFolderRetry((value) => value + 1);
              }}>Try again</button>
          </div>
        );
      }
      const folderId = folderMatch[1];
      const folder = currentFolders.folders.find((entry) => entry.id === folderId);
      if (!folder && folderId !== "new") {
        return <p role="alert" className="text-sm">Folder not found.</p>;
      }
      return (
        <FolderView
          key={folderId}
          folder={folder}
          onNavigate={navigate}
          onSaved={(updated) => setFolderList((current) =>
            current && current.userId === userId
              ? { ...current, folders: [...current.folders.filter((entry) => entry.id !== updated.id), updated] }
              : current
          )}
          onDeleted={(id) => setFolderList((current) =>
            current && current.userId === userId
              ? { ...current, folders: current.folders.filter((entry) => entry.id !== id) }
              : current
          )}
        />
      );
    }

    const editMatch = pathname.match(/^\/sets\/([^/]+)\/edit$/);
    if (editMatch) {
      return <SetFormView mode="edit" setId={editMatch[1]} onNavigate={navigate} />;
    }

    const setMatch = pathname.match(/^\/sets\/([^/]+)$/);
    if (setMatch) {
      return (
        <StudySetView
          setId={setMatch[1]}
          initialMode={modeParam === "test" ? "test" : "flashcards"}
          onNavigate={navigate}
        />
      );
    }

    const guideMatch = pathname.match(/^\/guides\/([^/]+)$/);
    if (guideMatch) {
      return <StudyGuideView guideId={guideMatch[1]} onNavigate={navigate} />;
    }

    if (pathname === "/settings") {
      return (
        <SettingsView
          user={user!}
          theme={theme}
          onToggleTheme={toggleTheme}
          onUserUpdated={(updated) => setUser(updated)}
        />
      );
    }

    if (pathname === "/admin") {
      return user?.role === "admin"
        ? <AdminView currentUserId={user.id} />
        : <div role="alert" className="mx-auto max-w-4xl">Administrator access required.</div>;
    }

    return <HomeView onNavigate={navigate} onOpenGenerate={() => setGenerateOpen(true)} />;
  }

  return (
    <>
      <AppShell
        user={user}
        folders={currentFolders?.folders}
        foldersFailed={currentFolders?.failed}
        currentPath={currentPath}
        searchQuery={searchQuery}
        theme={theme}
        onToggleTheme={toggleTheme}
        onNavigate={navigate}
        onOpenGenerate={() => setGenerateOpen(true)}
        onLogout={handleLogout}
      >
        {renderMainRoute()}
      </AppShell>

      <GenerateModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSaved={(newSetId) => {
          setGenerateOpen(false);
          navigate(`/sets/${newSetId}`);
        }}
      />
    </>
  );
}

