import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GitCompareArrows, Mic, Minus, Send, Sparkles, Square, X } from "lucide-react";
import ChatMessage from "./ChatMessage";
import TypingIndicator from "./TypingIndicator";
import SuggestedPrompts from "./SuggestedPrompts";
import AiResultCard from "./AiResultCard";
import useMotionSafe from "../../hooks/useMotionSafe";
import useSpeechInput from "../../hooks/useSpeechInput";
import aiApi from "../../services/aiApi";
import { panelVariants } from "../../utils/motion";

const GREETING = {
  id: "greeting",
  sender: "bot",
  text:
    "Hi. I can find and compare real businesses around you.\n\nTry asking for something specific — a category, a budget, a distance — and I will search live map data and LocalFinder listings.",
};

/**
 * The AI assistant panel.
 *
 * It talks only to our own /api/ai/search endpoint, which does the real
 * search and grounds the model's answer in it. Everything shown in a
 * result card here came back from that search, so a recommendation can
 * never reference a business the search did not actually return.
 */
export default function AiAssistant({ setSelectedPosition, userLocation }) {
  const { reduce, variants } = useMotionSafe();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [lastSearch, setLastSearch] = useState(null);
  const [aiAvailable, setAiAvailable] = useState(true);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const speech = useSpeechInput({
    onResult: (transcript) => {
      setInput(transcript);
      inputRef.current?.focus();
    },
  });

  /* Tell the user up front if AI is switched off on the server. */
  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    aiApi
      .status({ signal: controller.signal })
      .then((data) => setAiAvailable(data.available))
      .catch(() => {
        // Not knowing is not the same as being off; assume available and
        // let the first real request report any problem.
      });
    return () => controller.abort();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [messages, loading, open, reduce]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const focusPlace = useCallback(
    (place) => {
      setSelectedPosition?.([place.lat, place.lng]);
    },
    [setSelectedPosition]
  );

  const toggleCompare = useCallback((place) => {
    setCompareIds((current) =>
      current.includes(place.placeId)
        ? current.filter((id) => id !== place.placeId)
        : current.length >= 4
          ? current
          : [...current, place.placeId]
    );
  }, []);

  const send = useCallback(
    async (text) => {
      const value = String(text ?? input).trim();
      if (!value || loading) return;

      const history = messages
        .filter((message) => message.id !== "greeting")
        .slice(-6)
        .map((message) => ({ role: message.sender === "user" ? "user" : "assistant", content: message.text }));

      setMessages((current) => [...current, { id: `u-${Date.now()}`, sender: "user", text: value }]);
      setInput("");
      setLoading(true);

      try {
        const data = await aiApi.search({
          message: value,
          lat: userLocation?.lat,
          lng: userLocation?.lng,
          history,
        });

        setMessages((current) => [
          ...current,
          {
            id: `b-${Date.now()}`,
            sender: "bot",
            text: data.reply,
            results: data.results || [],
            meta: data.meta,
          },
        ]);

        if (data.results?.length > 0) {
          setLastSearch({
            lat: data.meta?.origin?.lat ?? userLocation?.lat,
            lng: data.meta?.origin?.lng ?? userLocation?.lng,
            category: data.intent?.category,
            radius: data.meta?.radiusUsed,
            language: data.intent?.language,
          });
          focusPlace(data.results[0]);
        }
      } catch (error) {
        setMessages((current) => [
          ...current,
          {
            id: `e-${Date.now()}`,
            sender: "bot",
            tone: "error",
            text:
              error.code === "RATE_LIMITED"
                ? error.message
                : error.message || "I could not reach the server. Check your connection and try again.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages, userLocation, focusPlace]
  );

  const compare = useCallback(async () => {
    if (compareIds.length < 2 || !lastSearch?.lat) return;
    setLoading(true);
    try {
      const data = await aiApi.compare({ placeIds: compareIds, ...lastSearch });
      setMessages((current) => [
        ...current,
        { id: `c-${Date.now()}`, sender: "user", text: `Compare ${compareIds.length} places` },
        { id: `cb-${Date.now()}`, sender: "bot", text: data.reply, results: data.compared || [] },
      ]);
      setCompareIds([]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        { id: `ce-${Date.now()}`, sender: "bot", tone: "error", text: error.message || "Could not compare those." },
      ]);
    } finally {
      setLoading(false);
    }
  }, [compareIds, lastSearch]);

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={reduce ? { opacity: 1 } : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { scale: 0.8, opacity: 0 }}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.95 }}
            aria-label="Open the AI assistant"
            className="fixed bottom-5 right-5 z-[950] flex h-14 w-14 items-center justify-center rounded-full bg-ai-500 shadow-lift transition-colors hover:bg-ai-600"
          >
            <Sparkles className="h-6 w-6 text-white" aria-hidden="true" />
            <span className="absolute inset-0 -z-10 animate-pulse-ring rounded-full bg-ai-400/40" aria-hidden="true" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open ? (
          <motion.aside
            variants={variants(panelVariants)}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label="LocalFinder AI assistant"
            className="fixed inset-x-3 bottom-3 z-[950] flex max-h-[80dvh] flex-col overflow-hidden rounded-xl2 border border-line bg-canvas shadow-lift sm:inset-x-auto sm:right-5 sm:w-[25rem]"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-ai-500">
                  <Sparkles className="h-4 w-4 text-white" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold text-ink">AI Assistant</p>
                  <p className="truncate text-2xs text-ink-muted">
                    {userLocation ? "Using your location" : "Share your location for nearby results"}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Minimise assistant"
                  className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMessages([GREETING]);
                    setCompareIds([]);
                    setOpen(false);
                  }}
                  aria-label="Close and clear the conversation"
                  className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {!aiAvailable ? (
              <p className="border-b border-warning-100 bg-warning-50 px-4 py-2 text-xs text-warning-700">
                The language model is not configured on this server. Searches still run and return real
                results, with a plain summary instead of a written recommendation.
              </p>
            ) : null}

            {/* Conversation */}
            <div ref={scrollRef} className="lf-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3.5">
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message}>
                  {message.results?.length > 0 && typeof message.results[0] === "object" ? (
                    <div className="mt-2 space-y-1.5">
                      {message.results.map((place, index) => (
                        <AiResultCard
                          key={place.placeId}
                          place={place}
                          index={index}
                          onFocus={focusPlace}
                          selected={compareIds.includes(place.placeId)}
                          onToggleCompare={toggleCompare}
                          userLocation={userLocation}
                        />
                      ))}
                      {message.meta?.attribution ? (
                        <p className="pt-0.5 text-[10px] text-ink-faint">{message.meta.attribution}</p>
                      ) : null}
                    </div>
                  ) : null}
                </ChatMessage>
              ))}

              <AnimatePresence>{loading ? <TypingIndicator /> : null}</AnimatePresence>

              {messages.length === 1 ? (
                <div className="pt-1">
                  <p className="mb-2 text-2xs font-bold uppercase tracking-wider text-ink-faint">Try asking</p>
                  <SuggestedPrompts onPick={send} />
                </div>
              ) : null}
            </div>

            {/* Compare bar */}
            <AnimatePresence>
              {compareIds.length > 0 ? (
                <motion.div
                  initial={reduce ? false : { height: 0, opacity: 0 }}
                  animate={reduce ? {} : { height: "auto", opacity: 1 }}
                  exit={reduce ? {} : { height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-line bg-ai-50 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-ai-700">
                      {compareIds.length} selected
                      {compareIds.length < 2 ? " · pick one more to compare" : ""}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCompareIds([])}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-ai-700 hover:bg-ai-100"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={compare}
                        disabled={compareIds.length < 2 || loading}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-ai-500 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-ai-600 disabled:opacity-50"
                      >
                        <GitCompareArrows className="h-3 w-3" aria-hidden="true" />
                        Compare
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>

            {/* Composer */}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              className="border-t border-line bg-surface p-2.5"
            >
              {speech.error ? <p className="mb-1.5 px-1 text-2xs text-danger-600">{speech.error}</p> : null}

              <div className="flex items-end gap-1.5">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={speech.listening ? "Listening…" : "Ask for anything nearby…"}
                  aria-label="Message the assistant"
                  maxLength={500}
                  className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-canvas px-3 text-sm text-ink-soft placeholder:text-ink-faint focus:border-ai-400 focus:outline-none focus:ring-4 focus:ring-ai-500/10"
                />

                {speech.supported ? (
                  <button
                    type="button"
                    onClick={speech.toggle}
                    aria-label={speech.listening ? "Stop listening" : "Speak your question"}
                    aria-pressed={speech.listening}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                      speech.listening
                        ? "border-danger-200 bg-danger-50 text-danger-600"
                        : "border-line text-ink-muted hover:bg-slate-50"
                    }`}
                  >
                    {speech.listening ? (
                      <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    ) : (
                      <Mic className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                ) : null}

                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai-500 text-white transition-colors hover:bg-ai-600 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </form>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </>
  );
}
