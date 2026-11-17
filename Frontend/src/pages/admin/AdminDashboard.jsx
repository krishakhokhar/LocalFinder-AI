import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarCheck,
  Flag,
  Mail,
  MessageSquare,
  Store,
  TrendingUp,
  Users,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import StatCard from "../../components/common/StatCard";
import ErrorState from "../../components/common/ErrorState";
import { StatSkeleton } from "../../components/common/Skeleton";
import TimeSeriesChart from "../../components/charts/TimeSeriesChart";
import BarList from "../../components/charts/BarList";
import { SERIES_COLORS } from "../../components/charts/chartTokens";
import adminApi from "../../services/adminApi";
import { categoryConfig } from "../../utils/categories";

const shortDay = (value) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

const STATUS_LABELS = {
  draft: "Draft",
  pending: "In review",
  approved: "Live",
  rejected: "Rejected",
  suspended: "Suspended",
};

const BOOKING_LABELS = {
  pending: "Awaiting reply",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Declined",
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.overview());
    } catch (requestError) {
      setError(requestError.message || "Could not load the dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AdminLayout title="Overview">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (unused, index) => (
            <StatSkeleton key={index} />
          ))}
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout title="Overview">
        <ErrorState message={error} onRetry={load} />
      </AdminLayout>
    );
  }

  const { totals, businessesByStatus, bookingsByStatus, series, topCategories } = data;

  return (
    <AdminLayout
      title="Overview"
      description="Everything on this page is a count of real records."
      counts={totals}
    >
      {/* Queues that need a human, first */}
      {totals.pendingBusinesses > 0 || totals.openReports > 0 || totals.newContacts > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          {totals.pendingBusinesses > 0 ? (
            <Link
              to="/admin/businesses?status=pending"
              className="flex items-center gap-3 rounded-card border border-warning-200 bg-warning-50 p-4 transition-colors hover:bg-warning-100"
            >
              <Store className="h-5 w-5 shrink-0 text-warning-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-warning-700">
                {totals.pendingBusinesses} listing{totals.pendingBusinesses === 1 ? "" : "s"} awaiting review
              </p>
            </Link>
          ) : null}

          {totals.openReports > 0 ? (
            <Link
              to="/admin/reports"
              className="flex items-center gap-3 rounded-card border border-danger-200 bg-danger-50 p-4 transition-colors hover:bg-danger-100"
            >
              <Flag className="h-5 w-5 shrink-0 text-danger-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-danger-700">
                {totals.openReports} open report{totals.openReports === 1 ? "" : "s"}
              </p>
            </Link>
          ) : null}

          {totals.newContacts > 0 ? (
            <Link
              to="/admin/contacts"
              className="flex items-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-4 transition-colors hover:bg-brand-100"
            >
              <Mail className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
              <p className="text-sm font-semibold text-brand-700">
                {totals.newContacts} unread message{totals.newContacts === 1 ? "" : "s"}
              </p>
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Users"
          value={totals.users}
          icon={Users}
          hint={`${totals.newUsers} joined in the last 30 days`}
        />
        <StatCard
          label="Live listings"
          value={totals.approvedBusinesses}
          icon={Store}
          tone="success"
          hint={`${totals.businesses} total, ${totals.pendingBusinesses} in review`}
        />
        <StatCard
          label="Bookings"
          value={totals.bookings}
          icon={CalendarCheck}
          tone="ai"
          hint="All time"
        />
        <StatCard
          label="Reviews"
          value={totals.reviews}
          icon={MessageSquare}
          tone="warning"
          hint={totals.hiddenReviews > 0 ? `${totals.hiddenReviews} hidden by moderation` : "All published"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-card border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-ink">
            <TrendingUp className="h-4 w-4 text-brand-600" aria-hidden="true" />
            Platform activity
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">Last 30 days</p>

          <div className="mt-4">
            <TimeSeriesChart
              data={series}
              series={[
                { key: "business_view", label: "Listing views", color: SERIES_COLORS[0] },
                { key: "search", label: "Searches", color: SERIES_COLORS[1] },
                { key: "signups", label: "Signups", color: SERIES_COLORS[2] },
              ]}
              formatX={shortDay}
              caption="Listing views, searches and signups over the last 30 days"
              emptyMessage="No activity recorded yet."
            />
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-display text-base font-bold text-ink">Listings by status</h2>
            <div className="mt-3">
              <BarList
                items={Object.entries(businessesByStatus).map(([status, count]) => ({
                  label: STATUS_LABELS[status] || status,
                  value: count,
                  color: status === "approved" ? SERIES_COLORS[2] : status === "pending" ? SERIES_COLORS[1] : undefined,
                }))}
                emptyMessage="No listings yet."
              />
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-display text-base font-bold text-ink">Bookings by status</h2>
            <div className="mt-3">
              <BarList
                items={Object.entries(bookingsByStatus).map(([status, count]) => ({
                  label: BOOKING_LABELS[status] || status,
                  value: count,
                }))}
                emptyMessage="No bookings yet."
              />
            </div>
          </section>

          <section className="rounded-card border border-line bg-surface p-5">
            <h2 className="font-display text-base font-bold text-ink">Busiest categories</h2>
            <div className="mt-3">
              <BarList
                items={topCategories.map((row) => ({
                  label: categoryConfig(row.category).label,
                  value: row.count,
                }))}
                formatValue={(value) => `${value} listing${value === 1 ? "" : "s"}`}
                emptyMessage="No approved listings yet."
              />
            </div>
          </section>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button to="/admin/businesses?status=pending" variant="outline" size="sm" icon={Store}>
          Review listings
        </Button>
        <Button to="/admin/reports" variant="outline" size="sm" icon={Flag}>
          Moderation queue
        </Button>
      </div>
    </AdminLayout>
  );
}
