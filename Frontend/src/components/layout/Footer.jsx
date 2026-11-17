import { Link } from "react-router-dom";
import { Building2, Heart, MapPin, Sparkles } from "lucide-react";

const COLUMNS = [
  {
    title: "Discover",
    links: [
      { to: "/explore", label: "Explore nearby" },
      { to: "/explore?category=restaurant", label: "Food & dining" },
      { to: "/explore?category=salon", label: "Salon & beauty" },
      { to: "/explore?category=spa", label: "Spa & gym" },
    ],
  },
  {
    title: "For business",
    links: [
      { to: "/auth?mode=register&role=owner", label: "List your business" },
      { to: "/owner", label: "Business dashboard" },
      { to: "/contact", label: "Partner support" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/contact", label: "Contact us" },
      { to: "/favorites", label: "Saved places" },
      { to: "/bookings", label: "My bookings" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="lf-container py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link to="/" className="flex items-center gap-2.5" aria-label="LocalFinder home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
                <MapPin className="h-[18px] w-[18px] text-white" aria-hidden="true" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-ink">
                Local<span className="text-brand-600">Finder</span>
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">
              Discover local. Compare smart. Choose better. Real businesses near you, with genuine
              reviews and AI that actually understands what you are looking for.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-ai-50 px-3 py-1 text-xs font-semibold text-ai-700">
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                AI powered
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700">
                <Building2 className="h-3 w-3" aria-hidden="true" />
                Verified listings
              </span>
            </div>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-display text-sm font-bold text-ink">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-ink-muted transition-colors hover:text-brand-700"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink-faint">
            &copy; {new Date().getFullYear()} LocalFinder-AI. All rights reserved.
          </p>

          {/* Attribution is a licence requirement for OpenStreetMap data, not
              decoration - it stays on every page. */}
          <p className="text-xs text-ink-faint">
            Place data &copy;{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium underline decoration-line-strong underline-offset-2 hover:text-ink-muted"
            >
              OpenStreetMap
            </a>{" "}
            contributors, available under the ODbL.
          </p>

          <p className="flex items-center gap-1.5 text-xs text-ink-faint">
            Built with <Heart className="h-3 w-3 text-danger-500" aria-hidden="true" /> for local discovery
          </p>
        </div>
      </div>
    </footer>
  );
}
