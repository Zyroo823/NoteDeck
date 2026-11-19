import { useCallback, useEffect, useRef, useState } from "react";
import type { NotificationInbox } from "@/src/types/api";

interface InboxState {
  userId: string;
  inbox?: NotificationInbox;
  error?: string;
  saving?: boolean;
}

export function useNotifications(userId: string | undefined, currentPath: string) {
  const [state, setState] = useState<InboxState>();
  const request = useRef<{ controller: AbortController; saving: boolean } | null>(null);

  const update = useCallback(async (readIds?: string[]) => {
    if (!userId || request.current?.saving || (!readIds && request.current)) return;
    const ownerId = userId;
    request.current?.controller.abort();
    const controller = new AbortController();
    const signal = controller.signal;
    request.current = { controller, saving: Boolean(readIds) };

    function updateState(changes: Omit<InboxState, "userId">) {
      setState((previous) => ({ ...(previous?.userId === ownerId ? previous : {}), ...changes, userId: ownerId }));
    }

    updateState({ error: undefined, saving: Boolean(readIds) });
    try {
      const response = readIds
        ? await fetch("/api/notifications/read", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: readIds }),
          signal,
        })
        : await fetch("/api/notifications", { signal });
      if (!response.ok) throw new Error();
      const inbox = await response.json() as NotificationInbox;
      if (!signal.aborted) updateState({ inbox, saving: false });
    } catch {
      if (!signal.aborted) updateState({
        error: readIds ? "Could not mark notifications as read. Please try again." : "Could not load notifications.",
        saving: false,
      });
    } finally {
      if (request.current?.controller === controller) request.current = null;
    }
  }, [userId]);

  useEffect(() => {
    return () => {
      request.current?.controller.abort();
      request.current = null;
    };
  }, [userId]);

  useEffect(() => { void update(); }, [update, currentPath]);

  useEffect(() => {
    if (!userId) return;
    function refreshVisible() {
      if (!document.hidden) void update();
    }
    const interval = window.setInterval(refreshVisible, 45_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [userId, update]);

  const current = state?.userId === userId ? state : undefined;
  return { inbox: current?.inbox, error: current?.error, saving: current?.saving ?? false, update };
}
