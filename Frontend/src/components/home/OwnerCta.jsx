import { ArrowRight, BarChart3, CalendarRange, Store } from "lucide-react";
import Button from "../common/Button";
import Reveal from "../common/Reveal";

const BENEFITS = [
  { icon: Store, label: "A listing customers can actually find" },
  { icon: CalendarRange, label: "Appointments booked straight into your calendar" },
  { icon: BarChart3, label: "Views, enquiries and reviews in one dashboard" },
];

/** Closing call to action for the business-owner side of the marketplace. */
export default function OwnerCta() {
  return (
    <section className="py-16 sm:py-20">
      <div className="lf-container">
        <Reveal className="overflow-hidden rounded-xl2 border border-line bg-ink px-6 py-12 shadow-card sm:px-12">
          <div className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-200">
                For business owners
              </span>
              <h2 className="mt-4 font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                Put your business where people are already looking
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">
                Claim a listing, publish your services and hours, and take appointments. Free to set
                up, and reviewed by a human before it goes live.
              </p>

              <ul className="mt-6 space-y-2.5">
                {BENEFITS.map((benefit) => (
                  <li key={benefit.label} className="flex items-center gap-3 text-sm text-slate-200">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <benefit.icon className="h-4 w-4 text-brand-200" aria-hidden="true" />
                    </span>
                    {benefit.label}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button to="/auth?mode=register&role=owner" size="lg" iconRight={ArrowRight}>
                  List your business
                </Button>
                <Button
                  to="/contact"
                  size="lg"
                  variant="ghost"
                  className="text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  Talk to us
                </Button>
              </div>
            </div>

            {/* An abstract panel rather than a stock photo of a shop that is
                not one of our customers. */}
            <div aria-hidden="true" className="relative hidden h-64 lg:block">
              <div className="absolute inset-0 rounded-xl2 bg-gradient-to-br from-brand-600/30 to-ai-500/20 blur-2xl" />
              <div className="absolute inset-4 rounded-xl2 border border-white/10 bg-white/5 backdrop-blur-sm">
                <div className="space-y-3 p-6">
                  <div className="h-2.5 w-24 rounded-full bg-white/25" />
                  <div className="h-2 w-40 rounded-full bg-white/15" />
                  <div className="mt-6 grid grid-cols-3 gap-3">
                    {[
                      { label: "Views", width: 72 },
                      { label: "Enquiries", width: 48 },
                      { label: "Rating", width: 90 },
                    ].map((item) => (
                      <div key={item.label} className="rounded-xl bg-white/10 p-3">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-white/60">
                          {item.label}
                        </div>
                        <div className="mt-2 h-1.5 w-full rounded-full bg-white/20">
                          <div
                            className="h-full rounded-full bg-brand-300"
                            style={{ width: `${item.width}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
