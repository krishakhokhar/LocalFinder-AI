import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarClock,
  CalendarX,
  CheckCheck,
  MessageSquare,
  Shield,
  Store,
  Trash2,
} from "lucide-react";
import AppShell from "../components/layout/AppShell";
import PageTransition from "../components/motion/PageTransition";
import Button from "../components/common/Button";
import EmptyState from "../components/common/EmptyState";
import ErrorState from "../components/common/ErrorState";
import Pagination from "../components/common/Pagination";
import Skeleton from "../components/common/Skeleton";
import notificationApi from "../services/notificationApi";
import { formatRelative } from "../utils/format";

const ICONS = {
  booking_created: CalendarClock,
  booking_confirmed: CalendarCheck,
  booking_rejected: CalendarX,
  booking_cancelled: CalendarX,
  booking_completed: CheckCheck,
  booking_reminder: Bell,
  business_submitted: Store,
  business_approved: Store,
  business_rejected: Store,
  business_suspended: Shield,
  review_received: MessageSquare,
  review_removed: Shield,
  report_resolved: Shield,
  account: Shield,
};

const TONES = {
  booking_confirmed: "bg-success-50 text-success-600",
  booking_completed: "bg-success-50 text-success-600",
  business_approved: "bg-success-50 text-success-600",
  booking_rejected: "bg-danger-50 text-danger-600",
  booking_cancelled: "bg-danger-50 text-danger-600",
  business_rejected: "bg-danger-50 text-danger-600",
  business_suspended: "bg-danger-50 text-danger-600",
  booking_reminder: "bg-warning-50 text-warning-600",
  review_received: "bg-ai-50 text-ai-600",
};

export default function Notifications({ onRead }) {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await notificationApi.list({ page, limit: 20, unreadOnly: unreadOnly ? "true" : undefined });
      setItems(data.notifications);
      setPages(data.pages);
      setUnread(data.unread);
    } catch (requestError) {
      setError(requestError.message || "Could not load your notifications.");
    } finally {
      setLoading(false);
    }
  }, [page, unreadOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (notification) => {
    if (notification.read) return;
    // Mark read optimistically; the badge should drop the moment it is tapped.
    setItems((current) =>
      current.map((item) => (item._id === notification._id ? { ...item, read: true } : item))
    );
    setUnread((current) => Math.max(0, current - 1));
    onRead?.();
    try {
      await notificationApi.markRead(notification._id);
    } catch {
      await load();
    }
  };

  const markAll = async () => {
    try {
      await notificationApi.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setUnread(0);
      onRead?.();
      toast.success("All caught up");
    } catch (markError) {
      toast.error(markError.message || "Could not mark everything read");
    }
  };

  const remove = async (notification) => {
    setItems((current) => current.filter((item) => item._id !== notification._id));
    try {
      await notificationApi.remove(notification._id);
    } catch {
      await load();
    }
  };

  return (
    <AppShell>
      <PageTransition>
        <div className="lf-container max-w-2xl py-8 sm:py-10">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50">
                  <Bell className="h-5 w-5 text-brand-600" aria-hidden="true" />
                  {unread > 0 ? (
                    <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </span>
                Notifications
              </h1>
              <p className="mt-1.5 text-sm text-ink-muted">
                {unread > 0 ? `${unread} unread` : "You are all caught up."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUnreadOnly((value) => !value);
                  setPage(1);
                }}
                aria-pressed={unreadOnly}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  unreadOnly
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-ink-muted hover:bg-slate-50"
                }`}
              >
                Unread only
              </button>
              {unread > 0 ? (
                <Button variant="outline" size="xs" icon={CheckCheck} onClick={markAll}>
                  Mark all read
                </Button>
              ) : null}
            </div>
          </header>

          <div className="mt-6 space-y-2">
            {loading ? (
              Array.from({ length: 5 }, (unusedValue, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-card" />
              ))
            ) : error ? (
              <ErrorState message={error} onRetry={load} />
            ) : items.length === 0 ? (
              <EmptyState
                icon={BellOff}
                title={unreadOnly ? "Nothing unread" : "No notifications yet"}
                description="Booking updates, review activity and account notices land here."
                className="rounded-card border border-dashed border-line bg-surface"
              />
            ) : (
              items.map((notification) => {
                const Icon = ICONS[notification.type] || Bell;
                const tone = TONES[notification.type] || "bg-slate-100 text-ink-muted";
                const Wrapper = notification.link ? Link : "div";

                return (
                  <article
                    key={notification._id}
                    className={`group relative flex items-start gap-3 rounded-card border p-4 transition-colors ${
                      notification.read ? "border-line bg-surface" : "border-brand-200 bg-brand-50/40"
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>

                    <Wrapper
                      {...(notification.link ? { to: notification.link } : {})}
                      onClick={() => open(notification)}
                      className="min-w-0 flex-1"
                    >
                      <p className="flex items-center gap-2 text-sm font-bold text-ink">
                        {notification.title}
                        {!notification.read ? (
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />
                        ) : null}
                      </p>
                      {notification.body ? (
                        <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{notification.body}</p>
                      ) : null}
                      <p className="mt-1 text-xs text-ink-faint">{formatRelative(notification.createdAt)}</p>
                    </Wrapper>

                    <button
                      type="button"
                      onClick={() => remove(notification)}
                      aria-label="Remove notification"
                      className="shrink-0 rounded-lg p-1.5 text-ink-faint opacity-0 transition-opacity hover:bg-slate-100 hover:text-ink group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </article>
                );
              })
            )}
          </div>

          <Pagination page={page} pages={pages} onChange={setPage} className="mt-6" />
        </div>
      </PageTransition>
    </AppShell>
  );
}
