import { NavLink } from "react-router-dom";
import {
  Flag,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Shield,
  Store,
  Tags,
  Users,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import PageTransition from "../../components/motion/PageTransition";

const SECTIONS = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/businesses", label: "Listings", icon: Store, badge: "pendingBusinesses" },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { to: "/admin/reports", label: "Reports", icon: Flag, badge: "openReports" },
  { to: "/admin/contacts", label: "Messages", icon: Mail, badge: "newContacts" },
  { to: "/admin/categories", label: "Categories", icon: Tags },
];

/**
 * Shared frame for the admin area.
 *
 * Badge counts are passed down from whichever page loaded the overview,
 * so the queue sizes are visible from every section without each one
 * refetching them.
 */
export default function AdminLayout({ title, description, actions, counts = {}, children }) {
  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container py-6 sm:py-8">
          <header className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ai-50">
              <Shield className="h-4 w-4 text-ai-600" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-ai-700">Admin</p>
              <h1 className="font-display text-xl font-extrabold tracking-tight text-ink sm:text-2xl">
                {title}
              </h1>
            </div>
          </header>

          {/* Section nav */}
          <nav aria-label="Admin sections" className="lf-no-scrollbar mt-5 flex gap-1.5 overflow-x-auto pb-1">
            {SECTIONS.map((section) => {
              const count = section.badge ? counts[section.badge] : 0;
              return (
                <NavLink
                  key={section.to}
                  to={section.to}
                  end={section.end}
                  className={({ isActive }) =>
                    `inline-flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                      isActive
                        ? "border-ink bg-ink text-white"
                        : "border-line bg-surface text-ink-muted hover:bg-slate-50"
                    }`
                  }
                >
                  <section.icon className="h-4 w-4" aria-hidden="true" />
                  {section.label}
                  {count > 0 ? (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                      {count > 99 ? "99+" : count}
                    </span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          {description || actions ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              {description ? <p className="text-sm text-ink-muted">{description}</p> : <span />}
              {actions}
            </div>
          ) : null}

          <div className="mt-5">{children}</div>
        </div>
      </PageTransition>
    </AppShell>
  );
}
