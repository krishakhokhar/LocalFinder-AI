import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import Button from "../common/Button";
import useMotionSafe from "../../hooks/useMotionSafe";
import useGeolocation from "../../hooks/useGeolocation";
import useSearchHistory from "../../hooks/useSearchHistory";
import { fadeUp, scaleIn, staggerContainer, transitions } from "../../utils/motion";
import { categoryConfig } from "../../utils/categories";
import RotatingWords from "./RotatingWords";
import SignalField from "../motion/SignalField";

const QUICK_CATEGORIES = ["salon", "restaurant", "spa", "shopping", "electrician", "car"];

const SUBTITLE =
  "Find trusted businesses, discover hidden places and explore everything around you with AI.".split(
    " "
  );

// Softer and shorter than the shared fadeUp - a paragraph revealing word
// by word should feel like text settling, not like each word arriving.
const wordReveal = {
  hidden: { opacity: 0, y: 8, filter: "blur(4px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.42, ease: [0.16, 1, 0.3, 1] } },
};

// Headline phrases. `break` forces a line break on wider screens so it
// reads as two balanced lines.
const HEADLINE = [
  { text: "Discover local." },
  { text: "Compare smart.", break: true },
  { text: "Choose better." },
];

/**
 * Ambient cards that drift behind the hero.
 *
 * These show category names and a pin - never a business name, rating or
 * price. Inventing a plausible-looking listing here would be fabricated
 * business data sitting on the landing page, which is exactly what the
 * product promises not to do.
 */
// Distinct durations and drifts so the group never pulses in unison -
// synchronised floating reads as a single mechanical animation.
const FLOATERS = [
  { key: "salon", className: "left-[3%] top-[20%] lg:left-[6%]", delay: 0, drift: 12, duration: 6.5 },
  { key: "restaurant", className: "right-[3%] top-[15%] lg:right-[7%]", delay: 0.6, drift: -14, duration: 8.2 },
  { key: "health", className: "left-[5%] bottom-[14%] lg:left-[11%]", delay: 1.1, drift: -10, duration: 7.4 },
  { key: "shopping", className: "right-[5%] bottom-[18%] lg:right-[9%]", delay: 0.3, drift: 13, duration: 9.1 },
];

function FloatingCards({ reduce }) {
  // Shown from lg up. Below that the hero is a single column and floating
  // cards would sit on top of the search box.
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      {FLOATERS.map((item) => {
        const config = categoryConfig(item.key);
        const Icon = config.icon;
        return (
          <motion.div
            key={item.key}
            className={`absolute ${item.className}`}
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.9 }}
            animate={
              reduce
                ? { opacity: 1 }
                : { opacity: 1, y: [0, item.drift, 0], rotate: [0, item.drift > 0 ? 1.5 : -1.5, 0], scale: 1 }
            }
            transition={
              reduce
                ? { duration: 0 }
                : {
                    opacity: { duration: 0.5, delay: 0.4 + item.delay },
                    scale: { duration: 0.5, delay: 0.4 + item.delay },
                    y: { duration: item.duration, repeat: Infinity, ease: "easeInOut", delay: item.delay },
                    rotate: { duration: item.duration, repeat: Infinity, ease: "easeInOut", delay: item.delay },
                  }
            }
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-lift backdrop-blur">
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${config.tint}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-bold text-ink">{config.label}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/**
 * Above the fold: one sentence of positioning, one search box, and a row
 * of categories. Light, generous and uncluttered - the hero's job is to
 * get someone searching in under five seconds, not to show off.
 */
export default function Hero() {
  const navigate = useNavigate();
  const { variants, reduce } = useMotionSafe();
  const { request, isLocating } = useGeolocation();
  const { remember } = useSearchHistory();
  const [term, setTerm] = useState("");

  const submit = (event) => {
    event.preventDefault();
    const query = term.trim();
    if (query) remember(query);
    navigate(query ? `/explore?q=${encodeURIComponent(query)}` : "/explore");
  };

  const useMyLocation = async () => {
    await request();
    navigate("/explore");
  };

  return (
    <section className="relative overflow-hidden border-b border-line bg-surface">
      {/* Restrained ambience: two soft washes and a grid, nothing that
          competes with the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {/* Two slow, offset drifts. Transform and opacity only, so this
            stays on the compositor and never reflows the page. */}
        <motion.div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl"
          animate={reduce ? undefined : { x: [0, 26, 0], y: [0, 18, 0], opacity: [0.6, 0.85, 0.6] }}
          transition={reduce ? undefined : { duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-ai-100/50 blur-3xl"
          animate={reduce ? undefined : { x: [0, -22, 0], y: [0, 24, 0], opacity: [0.5, 0.8, 0.5] }}
          transition={reduce ? undefined : { duration: 18, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        />
        {/* The dot field replaces the old static grid rather than stacking
            on top of it - two textures behind the same headline would be
            noise, and the headline is itself drawn on a canvas. */}
        {/* Dark enough to actually read against the light surface - the
            earlier values were effectively white on white. */}
        <SignalField
          className="opacity-100"
          dotColor="rgba(51,65,85,0.85)"
          accent="#1D4ED8"
          spacing={7}
        />

        {/* Softens the map directly behind the copy. The dots are strong
            enough to read as continents now, which also means they would
            compete with the headline without this - so the centre is
            lifted while the edges keep their detail. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 58% 52% at 50% 46%, rgba(255,255,255,0.93) 0%, rgba(255,255,255,0.80) 45%, rgba(255,255,255,0) 78%)",
          }}
        />
      </div>

      <FloatingCards reduce={reduce} />

      <motion.div
        variants={variants(staggerContainer(0.08, 0.05))}
        initial="hidden"
        animate="visible"
        className="lf-container relative py-16 text-center sm:py-24"
      >
        <motion.div variants={variants(scaleIn)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-ai-200 bg-ai-50 px-3.5 py-1.5 text-xs font-semibold text-ai-700">
            <motion.span
              animate={reduce ? undefined : { rotate: [0, 12, -8, 0], scale: [1, 1.15, 1] }}
              transition={
                reduce ? undefined : { duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }
              }
              className="inline-flex"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </motion.span>
            AI-powered local discovery
          </span>
        </motion.div>

        {/* Phrase-by-phrase entrance. Split on phrases rather than single
            words so the line still reads as a sentence while it lands, and
            kept as one <h1> so assistive tech sees one heading. */}
        {/* Real, crisp type - not a canvas. The particle version sampled
            the glyphs into dots, which read as pixelated at this size.
            This keeps the letterforms sharp and carries the motion in a
            gradient that sweeps across them continuously. */}
        <motion.h1
          variants={variants(staggerContainer(0.09))}
          className="mx-auto mt-6 max-w-3xl font-display text-[2rem] font-extrabold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]"
        >
          {HEADLINE.map((phrase) => (
            <motion.span
              key={phrase.text}
              variants={variants(fadeUp)}
              className="lf-sheen inline-block"
            >
              {phrase.text}
              {phrase.break ? <br className="hidden sm:block" /> : " "}
            </motion.span>
          ))}
        </motion.h1>

        {/* Keeps running after the entrance has finished, so the hero is
            never completely still. */}
        {/* RotatingWords renders the whole line, including the fixed words
            either side - it needs them inside its own flex row so the pill
            can push them as it resizes. */}
        <motion.p
          variants={variants(fadeUp)}
          className="mt-6 flex justify-center font-display text-[1.375rem] tracking-[-0.015em] sm:text-[1.625rem]"
        >
          <RotatingWords />
        </motion.p>

        {/* Revealed word by word. Each word is its own inline-block so the
            transform never affects the line box - the paragraph wraps
            exactly as it would without any animation. */}
        <motion.p
          variants={variants(staggerContainer(0.028, 0.12))}
          className="mx-auto mt-4 max-w-2xl text-balance text-[1.0625rem] font-normal leading-[1.75] tracking-[-0.011em] text-ink-muted sm:text-lg"
        >
          {SUBTITLE.map((word, index) => (
            <motion.span
              // Words repeat, so the index has to be part of the key.
              key={`${word}-${index}`}
              variants={variants(wordReveal)}
              className="inline-block"
            >
              {word === "AI." ? <span className="font-semibold text-ink-soft">{word}</span> : word}
              {index < SUBTITLE.length - 1 ? " " : null}
            </motion.span>
          ))}
        </motion.p>

        {/* Search */}
        <motion.form
          variants={variants(fadeUp)}
          onSubmit={submit}
          role="search"
          className="mx-auto mt-8 flex w-full max-w-xl flex-col gap-2.5 sm:flex-row"
        >
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint"
              aria-hidden="true"
            />
            <input
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Try &ldquo;salon&rdquo;, &ldquo;biryani&rdquo; or &ldquo;car service&rdquo;"
              aria-label="Search for a business or service"
              className="h-12 w-full rounded-xl border border-line bg-surface py-3.5 pl-11 pr-4 text-sm text-ink-soft shadow-soft transition-all placeholder:text-ink-faint hover:border-line-strong focus:border-brand-600 focus:outline-none focus:ring-4 focus:ring-brand-600/10"
            />
          </div>
          <Button type="submit" size="lg" iconRight={ArrowRight} className="sm:px-7">
            Search
          </Button>
        </motion.form>

        <motion.div variants={variants(fadeUp)} className="mt-3">
          <motion.button
            type="button"
            onClick={useMyLocation}
            disabled={isLocating}
            whileHover={reduce || isLocating ? undefined : { y: -2 }}
            whileTap={reduce || isLocating ? undefined : { scale: 0.97 }}
            transition={transitions.snappy}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <motion.span
                animate={reduce ? undefined : { y: [0, -2.5, 0] }}
                transition={reduce ? undefined : { duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                className="inline-flex"
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
              </motion.span>
            )}
            {isLocating ? "Finding you…" : "Use my current location"}
          </motion.button>
        </motion.div>

        {/* Category shortcuts */}
        <motion.div
          variants={variants(staggerContainer(0.04, 0.2))}
          className="mx-auto mt-9 flex max-w-2xl flex-wrap items-center justify-center gap-2"
        >
          {QUICK_CATEGORIES.map((key) => {
            const config = categoryConfig(key);
            const Icon = config.icon;
            return (
              <motion.button
                key={key}
                variants={variants(fadeUp)}
                type="button"
                onClick={() => navigate(`/explore?category=${key}`)}
                whileHover={reduce ? undefined : { y: -2 }}
                transition={transitions.snappy}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft shadow-soft transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {config.label}
              </motion.button>
            );
          })}
        </motion.div>
      </motion.div>
    </section>
  );
}
