import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import SectionHeading from "../common/SectionHeading";
import { RevealGroup, RevealItem } from "../common/Reveal";
import useMotionSafe from "../../hooks/useMotionSafe";
import { transitions } from "../../utils/motion";
import { categoryConfig } from "../../utils/categories";

const CATEGORIES = [
  { key: "salon", blurb: "Haircuts, grooming and beauty parlours" },
  { key: "restaurant", blurb: "Restaurants, cafés and takeaways" },
  { key: "spa", blurb: "Gyms, fitness studios and wellness" },
  { key: "plumber", blurb: "Leaks, fittings and pipe repair" },
  { key: "electrician", blurb: "Wiring, repairs and installation" },
  { key: "car", blurb: "Servicing, repairs and garages" },
  { key: "health", blurb: "Clinics, hospitals and pharmacies" },
  { key: "all", blurb: "Everything open around you" },
];

/** Category entry points, staggered in as the section scrolls into view. */
export default function CategoryGrid() {
  const navigate = useNavigate();
  const { reduce } = useMotionSafe();

  return (
    <section className="py-16 sm:py-20">
      <div className="lf-container">
        <SectionHeading
          eyebrow="Browse"
          title="What are you looking for today?"
          subtitle="Pick a category to see real businesses near you, ranked by distance and genuine ratings."
        />

        <RevealGroup stagger={0.05} className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const config = categoryConfig(category.key);
            const Icon = config.icon;

            return (
              <RevealItem key={category.key}>
                <motion.button
                  type="button"
                  onClick={() => navigate(`/explore?category=${category.key}`)}
                  whileHover={reduce ? undefined : { y: -4 }}
                  whileTap={reduce ? undefined : { scale: 0.985 }}
                  transition={transitions.snappy}
                  className="group flex h-full w-full flex-col items-start rounded-card border border-line bg-surface p-5 text-left shadow-soft transition-shadow hover:border-brand-200 hover:shadow-card"
                >
                  <span
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${config.tint} transition-transform duration-300 group-hover:scale-110`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <span className="mt-4 flex w-full items-center justify-between gap-2">
                    <span className="font-display text-sm font-bold text-ink">{config.label}</span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-ink-faint opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="mt-1 text-xs leading-relaxed text-ink-muted">{category.blurb}</span>
                </motion.button>
              </RevealItem>
            );
          })}
        </RevealGroup>
      </div>
    </section>
  );
}
