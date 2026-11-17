import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input via the browser's own Web Speech API.
 *
 * Entirely optional: `supported` is false on browsers that do not
 * implement it (Firefox, most of iOS), and the UI simply does not show
 * the microphone there rather than offering a button that cannot work.
 *
 * Recognition runs in the browser. Nothing is recorded or uploaded by
 * this app - the transcript is placed in the text box for the user to
 * review and send themselves.
 */
export function useSpeechInput({ lang = "en-IN", onResult } = {}) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const callbackRef = useRef(onResult);

  useEffect(() => {
    callbackRef.current = onResult;
  }, [onResult]);

  const SpeechRecognition =
    typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const supported = Boolean(SpeechRecognition);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) return;
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript;
      if (transcript) callbackRef.current?.(transcript);
    };
    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was blocked."
          : event.error === "no-speech"
            ? "I did not catch that. Try again."
            : "Voice input is not available right now."
      );
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setError("");
    setListening(true);
    try {
      recognition.start();
    } catch {
      setListening(false);
    }
  }, [SpeechRecognition, lang]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported, listening, error, start, stop, toggle: () => (listening ? stop() : start()) };
}

export default useSpeechInput;
