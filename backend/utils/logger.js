/**
 * Tiny level-aware logger. Deliberately dependency-free and synchronous:
 * the goal is consistent, greppable output (and one place to swap in a real
 * log shipper later), not a logging framework.
 */
import { env } from "../config/env.js";

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const threshold = LEVELS[env.logLevel] ?? LEVELS.info;

function emit(level, scope, message, meta) {
  if (LEVELS[level] > threshold) return;
  const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  if (meta !== undefined) sink(line, meta);
  else sink(line);
}

export function createLogger(scope) {
  return {
    error: (message, meta) => emit("error", scope, message, meta),
    warn: (message, meta) => emit("warn", scope, message, meta),
    info: (message, meta) => emit("info", scope, message, meta),
    debug: (message, meta) => emit("debug", scope, message, meta),
  };
}

export const logger = createLogger("app");
