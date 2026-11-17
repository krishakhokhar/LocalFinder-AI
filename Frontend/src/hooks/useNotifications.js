import { useCallback, useEffect, useRef, useState } from "react";
import notificationApi from "../services/notificationApi";
import { useAuth } from "../context/AuthContext";

const POLL_MS = 60 * 1000;

/**
 * Unread notification count for the navbar badge.
 *
 * Polled rather than pushed: a websocket for a number that changes a few
 * times a day is a connection to keep alive, a reconnect strategy to get
 * right and a scaling constraint on the server, in exchange for latency
 * nobody will notice. One indexed count a minute is the cheaper trade.
 *
 * Polling pauses while the tab is hidden and refreshes immediately when
 * it comes back, so a backgrounded tab costs nothing.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [unread, setUnread] = useState(0);
  const timer = useRef(null);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || document.hidden) return;
    try {
      const data = await notificationApi.unreadCount();
      setUnread(data.unread || 0);
    } catch {
      // A failed count is not worth telling anyone about.
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnread(0);
      return undefined;
    }

    refresh();
    timer.current = setInterval(refresh, POLL_MS);

    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAuthenticated, refresh]);

  return { unread, refresh, setUnread };
}

export default useNotifications;
