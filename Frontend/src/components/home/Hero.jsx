import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, MapPin, Search, Sparkles } from "lucide-react";
import Button from "../common/Button";
import useMotionSafe from "../../hooks/useMotionSafe";
import useGeolocation from "../../hooks/useGeolocation";
import useSearchHistory from "../../hooks/useSearchHistory";
import { fadeUp, staggerContainer, transitions } from "../../utils/motion";
import { categoryConfig } from "../../utils/categories";

const QUICK_CATEGORIES = ["salon", "restaurant", "spa", "shopping", "electrician", "car"];

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
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand-100/60 blur-3xl" />
        <div className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-ai-100/50 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(#E2E8F0 1px, transparent 1px), linear-gradient(90deg, #E2E8F0 1px, transparent 1px)",
            backgroundSize: "64px 64px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, #000 40%, transparent 100%)",
          }}
        />
      </div>

      <motion.div
        variants={variants(staggerContainer(0.08, 0.05))}
        initial="hidden"
        animate="visible"
        className="lf-container relative py-16 text-center sm:py-24"
      >
        <motion.div variants={variants(fadeUp)}>
          <span className="inline-flex items-center gap-2 rounded-full border border-ai-200 bg-ai-50 px-3.5 py-1.5 text-xs font-semibold text-ai-700">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI-powered local discovery
          </span>
        </motion.div>

        <motion.h1
          variants={variants(fadeUp)}
          className="mx-auto mt-6 max-w-3xl font-display text-[2rem] font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]"
        >
          Discover local.{" "}
          <span className="text-brand-600">Compare smart.</span>
          <br className="hidden sm:block" /> Choose better.
        </motion.h1>

        <motion.p
          variants={variants(fadeUp)}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg"
        >
          Find real businesses around you, compare them on genuine reviews and prices, and book an
          appointment — all in one place.
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
          <button
            type="button"
            onClick={useMyLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800 disabled:opacity-60"
          >
            {isLocating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <MapPin className="h-4 w-4" aria-hidden="true" />
            )}
            {isLocating ? "Finding you…" : "Use my current location"}
          </button>
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
