import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "localfinder:search-history";
const MAX_ENTRIES = 8;

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

/**
 * Recent searches, kept on the device only. Nothing is sent to the server:
 * a search history is a record of what someone was looking for, and it has
 * no business leaving their browser.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState(read);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch {
      /* ignore */
    }
  }, [history]);

  const remember = useCallback((term) => {
    const value = String(term || "").trim();
    if (value.length < 2) return;
    setHistory((previous) => [value, ...previous.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, MAX_ENTRIES));
  }, []);

  const forget = useCallback((term) => {
    setHistory((previous) => previous.filter((item) => item !== term));
  }, []);

  const clear = useCallback(() => setHistory([]), []);

  return { history, remember, forget, clear };
}

export default useSearchHistory;
