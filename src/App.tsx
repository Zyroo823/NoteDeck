import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { AuthScreen } from "@/src/components/AuthScreen";
import { AppShell } from "@/src/components/AppShell";
import { HomeView } from "@/src/components/HomeView";
import { LibraryView } from "@/src/components/LibraryView";
import { SetFormView } from "@/src/components/SetFormView";
import { StudySetView } from "@/src/components/StudySetView";
import { StudyGuideView } from "@/src/components/StudyGuideView";
import { SettingsView } from "@/src/components/SettingsView";
import { GenerateModal } from "@/src/components/GenerateModal";
import type { AuthUser } from "@/src/types/api";

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

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAuthMode("login");
    navigate("/login");
  }

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0B0E17]">
        <Loader2 className="h-8 w-8 animate-spin text-[#5B6CFA]"/>
      </div>
    );
  }

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

  const parsedUrl = new URL(currentPath, "http://localhost");
  const pathname = parsedUrl.pathname;
  const searchQuery = parsedUrl.searchParams.get("q") ?? "";
  const typeParam = parsedUrl.searchParams.get("type");
  const modeParam = parsedUrl.searchParams.get("mode");

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

    return <HomeView onNavigate={navigate} onOpenGenerate={() => setGenerateOpen(true)} />;
  }

  return (
    <>
      <AppShell
        user={user}
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
