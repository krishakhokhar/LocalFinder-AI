import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "localfinder:last-location";
const MAX_AGE_MS = 30 * 60 * 1000;

function readCached() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.at > MAX_AGE_MS) return null;
    return { lat: parsed.lat, lng: parsed.lng, cached: true };
  } catch {
    return null;
  }
}

function writeCache(location) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...location, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * Browser geolocation with the parts every caller needs: an explicit
 * permission state, a cached last-known position so the map can render
 * something immediately, and messages a user can act on rather than raw
 * error codes.
 *
 * The last known position is cached for 30 minutes in localStorage. It is
 * the user's own coordinate, kept on their device and never sent anywhere
 * except as the search origin they asked for.
 */
export function useGeolocation({ auto = false } = {}) {
  const [location, setLocation] = useState(() => (auto ? readCached() : null));
  const [status, setStatus] = useState("idle"); // idle | locating | granted | denied | unavailable
  const [error, setError] = useState("");
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const request = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          setStatus("unavailable");
          setError("Your browser does not support location access.");
          resolve(null);
          return;
        }

        setStatus("locating");
        setError("");

        navigator.geolocation.getCurrentPosition(
          (position) => {
            const next = { lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy };
            writeCache(next);
            if (mounted.current) {
              setLocation(next);
              setStatus("granted");
            }
            resolve(next);
          },
          (positionError) => {
            const messages = {
              1: "Location access was blocked. Enable it in your browser settings, or search by city instead.",
              2: "We could not determine your location. Check that location services are on.",
              3: "Finding your location took too long. Please try again.",
            };
            if (mounted.current) {
              setStatus(positionError.code === 1 ? "denied" : "unavailable");
              setError(messages[positionError.code] || "Could not get your location.");
            }
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 5 * 60 * 1000, ...options }
        );
      }),
    []
  );

  useEffect(() => {
    if (auto) request();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when asked to
  }, [auto]);

  return { location, setLocation, status, error, request, isLocating: status === "locating" };
}

export default useGeolocation;
