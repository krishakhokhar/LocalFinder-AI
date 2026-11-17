import { CalendarCheck, MessageSquareText, Search, Star } from "lucide-react";
import SectionHeading from "../common/SectionHeading";
import { RevealGroup, RevealItem } from "../common/Reveal";

const STEPS = [
  {
    icon: Search,
    title: "Search around you",
    body: "Filter by category, distance, rating and opening hours. Results come from live map data, not a stale directory.",
  },
  {
    icon: MessageSquareText,
    title: "Ask the AI assistant",
    body: "Describe what you need in plain language, in English, Hindi or Gujarati, and get recommendations drawn only from real nearby results.",
  },
  {
    icon: Star,
    title: "Compare on genuine reviews",
    body: "Every rating comes from a LocalFinder user who reviewed that exact place. No generated scores, ever.",
  },
  {
    icon: CalendarCheck,
    title: "Book an appointment",
    body: "Pick a real available slot from the business's own calendar and get a confirmation you can track.",
  },
];

/** Four steps, numbered, revealed one after another. */
export default function HowItWorks() {
  return (
    <section className="py-16 sm:py-20">
      <div className="lf-container">
        <SectionHeading
          eyebrow="How it works"
          title="From a problem to a booking, in four steps"
          subtitle="Everything you need to choose well, without opening five tabs."
        />

        <RevealGroup stagger={0.08} className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <RevealItem key={step.title}>
              <div className="flex h-full flex-col rounded-card border border-line bg-surface p-6 shadow-soft">
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                    <step.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-display text-3xl font-extrabold text-slate-100" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-bold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
