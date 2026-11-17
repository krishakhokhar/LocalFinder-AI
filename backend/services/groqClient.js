import axios from "axios";
import { env } from "../config/env.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("groq");
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Thin Groq wrapper.
 *
 * The API key is read here and nowhere else, and never leaves the server.
 * Every call has a timeout and returns `null` rather than throwing, so a
 * slow or unavailable model degrades the assistant into a plain
 * search-results reply instead of breaking the request.
 */
export function isConfigured() {
  return Boolean(env.groqApiKey);
}

async function complete({ messages, temperature = 0.4, maxTokens = 700, json = false, timeout = 20000 }) {
  if (!isConfigured()) {
    log.warn("GROQ_API_KEY is not configured - skipping model call");
    return null;
  }

  try {
    const response = await axios.post(
      ENDPOINT,
      {
        model: env.groqModel,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: "json_object" } } : {}),
      },
      {
        headers: {
          Authorization: `Bearer ${env.groqApiKey}`,
          "Content-Type": "application/json",
        },
        timeout,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : null;
  } catch (error) {
    const status = error.response?.status;
    log.warn(`completion failed${status ? ` (HTTP ${status})` : ""}: ${error.message}`);
    return null;
  }
}

/**
 * Asks for strict JSON and parses it.
 *
 * Models occasionally wrap JSON in prose or a code fence even in JSON
 * mode, so the first balanced object in the response is extracted before
 * parsing. A response that still will not parse returns null, and the
 * caller falls back to deterministic logic rather than guessing.
 */
export async function completeJson(options) {
  const raw = await complete({ ...options, json: true, temperature: options.temperature ?? 0 });
  if (!raw) return null;

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch (error) {
    log.warn(`model returned unparseable JSON: ${error.message}`);
    return null;
  }
}

export const groq = { complete, completeJson, isConfigured };

export default groq;
