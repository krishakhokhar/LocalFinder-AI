import { API_BASE_URL } from "../config/api";

export const TOKEN_KEY = "token";
export const USER_KEY = "user";

/** Raised for any non-2xx response, carrying what the API actually said. */
export class ApiError extends Error {
  constructor(message, { status, code, errors, payload } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
    this.payload = payload;
  }

  /** First field-level message, for inline form errors. */
  fieldError(field) {
    return this.errors?.find((error) => error.field === field)?.message || null;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage can be unavailable in private mode - the session simply
       does not persist across reloads, which is acceptable */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Fired when the server rejects our token. AuthContext listens and signs
 * the user out, so an expired session is handled in one place rather than
 * by every caller.
 */
export const AUTH_EXPIRED_EVENT = "localfinder:auth-expired";

function buildUrl(path, params) {
  const url = new URL(
    path.startsWith("http") ? path : `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`
  );
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * One fetch wrapper for the whole app.
 *
 * Normalises three things every caller would otherwise repeat: attaching
 * the bearer token, turning a failed response into a thrown ApiError with
 * the server's own message, and distinguishing a network failure from an
 * HTTP error so the UI can say "check your connection" accurately.
 */
export async function request(path, { method = "GET", body, params, signal, auth = true, headers = {} } = {}) {
  const token = auth ? getToken() : null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  let response;
  try {
    response = await fetch(buildUrl(path, params), {
      method,
      signal,
      headers: {
        ...(isFormData ? {} : body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the server. Check your internet connection.", {
      status: 0,
      code: "NETWORK",
    });
  }

  let payload = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else {
    const text = await response.text().catch(() => "");
    payload = text ? { message: text } : null;
  }

  if (!response.ok || payload?.success === false) {
    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
    }
    throw new ApiError(payload?.message || `Request failed (${response.status})`, {
      status: response.status,
      code: payload?.code,
      errors: payload?.errors,
      payload,
    });
  }

  return payload ?? {};
}

export const api = {
  get: (path, options) => request(path, { ...options, method: "GET" }),
  post: (path, body, options) => request(path, { ...options, method: "POST", body }),
  patch: (path, body, options) => request(path, { ...options, method: "PATCH", body }),
  put: (path, body, options) => request(path, { ...options, method: "PUT", body }),
  delete: (path, options) => request(path, { ...options, method: "DELETE" }),
};

export default api;
