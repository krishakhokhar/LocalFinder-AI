import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  Eye,
  MessageSquare,
  Plus,
  Star,
  Store,
  TrendingUp,
} from "lucide-react";
import AppShell from "../../components/layout/AppShell";
import PageTransition from "../../components/motion/PageTransition";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import StatCard from "../../components/common/StatCard";
import { StatSkeleton } from "../../components/common/Skeleton";
import TimeSeriesChart from "../../components/charts/TimeSeriesChart";
import BarList from "../../components/charts/BarList";
import RatingStars from "../../components/reviews/RatingStars";
import ownerApi from "../../services/ownerApi";
import { formatDateTime, formatRelative } from "../../utils/format";
import { categoryConfig } from "../../utils/categories";
import { SERIES_COLORS } from "../../components/charts/chartTokens";

const STATUS_TONE = {
  draft: { tone: "neutral", label: "Draft" },
  pending: { tone: "warning", label: "In review" },
  approved: { tone: "success", label: "Live" },
  rejected: { tone: "danger", label: "Rejected" },
  suspended: { tone: "danger", label: "Suspended" },
};

const shortDay = (value, long = false) => {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("en-IN", long ? { day: "numeric", month: "short" } : { day: "numeric", month: "short" });
};

/**
 * The business owner's home.
 *
 * Every number comes from counted records. A brand-new listing shows
 * zeros and a clear next step, rather than a seeded figure that would
 * make the dashboard look alive at the cost of being false.
 */
export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedId, setSelectedId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await ownerApi.overview();
      setData(result);
      setSelectedId((current) => current || result.businesses[0]?._id || null);
    } catch (requestError) {
      setError(requestError.message || "Could not load your dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const controller = new AbortController();
    setAnalyticsLoading(true);
    ownerApi
      .analytics(selectedId, analyticsDays, { signal: controller.signal })
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
    return () => controller.abort();
  }, [selectedId, analyticsDays]);

  if (loading) {
    return (
      <AppShell>
        <div className="lf-container py-10">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (unused, index) => (
              <StatSkeleton key={index} />
            ))}
          </div>
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell>
        <div className="lf-container py-10">
          <ErrorState message={error} onRetry={load} />
        </div>
      </AppShell>
    );
  }

  const { businesses, totals, upcoming, recentReviews, needsAttention } = data;

  if (businesses.length === 0) {
    return (
      <AppShell>
        <PageTransition>
          <div className="lf-container py-10">
            <EmptyState
              icon={Store}
              title="List your first business"
              description="Add your business, publish your services and hours, and start taking enquiries and appointments. An admin reviews every new listing before it goes live."
              action={
                <Button to="/owner/businesses/new" icon={Plus}>
                  Add your business
                </Button>
              }
              className="rounded-card border border-dashed border-line bg-surface"
            />
          </div>
        </PageTransition>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container py-8 sm:py-10">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                Business dashboard
              </h1>
              <p className="mt-1 text-sm text-ink-muted">
                {businesses.length} listing{businesses.length === 1 ? "" : "s"} ·{" "}
                {businesses.filter((business) => business.status === "approved").length} live
              </p>
            </div>
            <Button to="/owner/businesses/new" icon={Plus} size="sm">
              Add business
            </Button>
          </header>

          {/* Things that need the owner */}
          {needsAttention.length > 0 ? (
            <ul className="mt-6 space-y-2">
              {needsAttention.slice(0, 4).map((item, index) => (
                <li
                  key={`${item.kind}-${item.businessId || index}`}
                  className="flex items-start gap-3 rounded-card border border-warning-100 bg-warning-50 px-4 py-3"
                >
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
                  <p className="flex-1 text-sm text-warning-700">
                    {item.name ? <span className="font-semibold">{item.name}: </span> : null}
                    {item.message}
                  </p>
                  {item.businessId ? (
                    <Link
                      to={`/owner/businesses/${item.businessId}`}
                      className="shrink-0 text-xs font-bold text-warning-700 underline-offset-2 hover:underline"
                    >
                      Fix
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}

          {/* Totals */}
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Profile views"
              value={totals.views}
              icon={Eye}
              hint="All time, across your listings"
            />
            <StatCard
              label="Enquiries"
              value={totals.inquiries}
              icon={MessageSquare}
              tone="ai"
              hint="Calls and contact taps"
            />
            <StatCard
              label="Bookings"
              value={totals.bookings}
              icon={CalendarClock}
              tone="success"
              hint={`${totals.pending} awaiting your reply`}
            />
            <StatCard
              label="Average rating"
              value={totals.rating}
              icon={Star}
              tone="warning"
              hint={`From ${totals.reviews} review${totals.reviews === 1 ? "" : "s"}`}
              unknownNote="No reviews yet"
            />
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            {/* Analytics */}
            <section className="rounded-card border border-line bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
                  <BarChart3 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                  Activity
                </h2>

                {/* Filters in one row above the chart they scope. */}
                <div className="flex flex-wrap items-center gap-2">
                  {businesses.length > 1 ? (
                    <select
                      value={selectedId || ""}
                      onChange={(event) => setSelectedId(event.target.value)}
                      aria-label="Choose a business"
                      className="h-8 max-w-[11rem] rounded-lg border border-line bg-surface pl-2 pr-7 text-xs font-semibold text-ink-soft focus:border-brand-600 focus:outline-none"
                    >
                      {businesses.map((business) => (
                        <option key={business._id} value={business._id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <div className="flex rounded-lg border border-line p-0.5">
                    {[7, 30, 90].map((days) => (
                      <button
                        key={days}
                        type="button"
                        onClick={() => setAnalyticsDays(days)}
                        aria-pressed={analyticsDays === days}
                        className={`rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
                          analyticsDays === days ? "bg-brand-600 text-white" : "text-ink-muted hover:bg-slate-100"
                        }`}
                      >
                        {days}d
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`mt-4 transition-opacity ${analyticsLoading ? "opacity-50" : ""}`}>
                <TimeSeriesChart
                  data={analytics?.series || []}
                  series={[
                    { key: "business_view", label: "Views", color: SERIES_COLORS[0] },
                    { key: "bookings", label: "Bookings", color: SERIES_COLORS[1] },
                  ]}
                  formatX={shortDay}
                  caption={`Views and bookings over the last ${analyticsDays} days`}
                  emptyMessage="No views yet. Once your listing is live and people find it, activity shows up here."
                />
              </div>

              {analytics ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    { label: "Views", value: analytics.totals.views },
                    { label: "Calls", value: analytics.totals.calls },
                    { label: "Directions", value: analytics.totals.directions },
                    { label: "Enquiries", value: analytics.totals.inquiries },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2">
                      <p className="text-xs text-ink-muted">{item.label}</p>
                      <p className="font-display text-lg font-bold tabular-nums text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {analytics?.popularServices?.length > 0 ? (
                <div className="mt-6">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
                    <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    Most booked services
                  </h3>
                  <BarList
                    items={analytics.popularServices.map((service) => ({
                      label: service.name,
                      value: service.bookings,
                    }))}
                    formatValue={(value) => `${value} booking${value === 1 ? "" : "s"}`}
                  />
                </div>
              ) : null}
            </section>

            {/* Side column */}
            <div className="space-y-6">
              <section className="rounded-card border border-line bg-surface p-5">
                <h2 className="font-display text-base font-bold text-ink">Your listings</h2>
                <ul className="mt-3 space-y-2">
                  {businesses.map((business) => {
                    const config = categoryConfig(business.category);
                    const Icon = config.icon;
                    const status = STATUS_TONE[business.status] || STATUS_TONE.draft;

                    return (
                      <li key={business._id}>
                        <Link
                          to={`/owner/businesses/${business._id}`}
                          className="flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                              business.logoUrl ? "" : config.tint
                            }`}
                          >
                            {business.logoUrl ? (
                              <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <Icon className="h-4 w-4" aria-hidden="true" />
                            )}
                          </span>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-ink">{business.name}</p>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              <Badge tone={status.tone} size="xs">
                                {status.label}
                              </Badge>
                              {business.verified ? (
                                <Badge tone="success" size="xs" icon={BadgeCheck}>
                                  Verified
                                </Badge>
                              ) : null}
                              <span className="text-2xs text-ink-faint">{business.viewCount} views</span>
                            </div>
                          </div>

                          {business.rating ? (
                            <span className="shrink-0 text-xs font-bold text-ink">{business.rating}</span>
                          ) : null}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-card border border-line bg-surface p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-ink">Upcoming</h2>
                  <Link
                    to="/owner/bookings"
                    className="text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
                  >
                    All bookings
                  </Link>
                </div>

                {upcoming.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    No upcoming appointments. Turn on bookings in your listing settings to start taking them.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {upcoming.slice(0, 5).map((booking) => (
                      <li key={booking._id} className="rounded-xl border border-line p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{booking.serviceName}</p>
                            <p className="truncate text-xs text-ink-muted">{booking.customerName}</p>
                          </div>
                          <Badge tone={booking.status === "pending" ? "warning" : "success"} size="xs">
                            {booking.status}
                          </Badge>
                        </div>
                        <p className="mt-1.5 text-xs font-medium text-brand-700">
                          {formatDateTime(booking.startAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-card border border-line bg-surface p-5">
                <h2 className="font-display text-base font-bold text-ink">Recent reviews</h2>
                {recentReviews.length === 0 ? (
                  <p className="mt-3 text-sm text-ink-muted">
                    No reviews yet. They appear here as customers write them.
                  </p>
                ) : (
                  <ul className="mt-3 space-y-3">
                    {recentReviews.map((review) => (
                      <li key={review._id} className="border-b border-line pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{review.author.name}</span>
                          <span className="shrink-0 text-2xs text-ink-faint">
                            {formatRelative(review.createdAt)}
                          </span>
                        </div>
                        <RatingStars value={review.rating} size="xs" className="mt-1" />
                        {review.comment ? (
                          <p className="lf-line-clamp-2 mt-1 text-xs leading-relaxed text-ink-muted">
                            {review.comment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      </PageTransition>
    </AppShell>
  );
}
