import { BadgeCheck, Database, Lock, Sparkles } from "lucide-react";
import { RevealGroup, RevealItem } from "../common/Reveal";

const POINTS = [
  {
    icon: Database,
    title: "Real data only",
    body: "Ratings, hours and phone numbers come from reviewers, business owners or OpenStreetMap. Missing data is labelled as missing.",
  },
  {
    icon: BadgeCheck,
    title: "Verified listings",
    body: "A business only gets the verified badge after a human admin has reviewed and approved the listing.",
  },
  {
    icon: Sparkles,
    title: "Grounded AI",
    body: "The assistant can only recommend places the search actually returned. It cannot invent a business.",
  },
  {
    icon: Lock,
    title: "Your location stays yours",
    body: "Coordinates are used to run your search and are never stored against your account.",
  },
];

/** The honesty commitments, stated plainly. */
export default function TrustStrip() {
  return (
    <section className="border-y border-line bg-surface py-14">
      <div className="lf-container">
        <RevealGroup stagger={0.06} className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {POINTS.map((point) => (
            <RevealItem key={point.title} className="flex gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ai-50 text-ai-600">
                <point.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-sm font-bold text-ink">{point.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{point.body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
