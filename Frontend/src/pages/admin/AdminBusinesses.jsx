import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  BadgeCheck,
  Check,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldOff,
  Store,
  X,
} from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Pagination from "../../components/common/Pagination";
import Skeleton from "../../components/common/Skeleton";
import { Textarea } from "../../components/common/Field";
import adminApi from "../../services/adminApi";
import useDebounce from "../../hooks/useDebounce";
import { categoryConfig } from "../../utils/categories";
import { formatRelative } from "../../utils/format";

const FILTERS = [
  { key: "pending", label: "In review" },
  { key: "approved", label: "Live" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
  { key: "draft", label: "Drafts" },
  { key: "", label: "All" },
];

const STATUS_TONE = {
  draft: "neutral",
  pending: "warning",
  approved: "success",
  rejected: "danger",
  suspended: "danger",
};

/**
 * The approval queue.
 *
 * Pending listings are shown oldest first, because a queue sorted
 * newest-first quietly never reaches the bottom. Every rejection and
 * suspension requires a reason, which the owner is shown - "rejected"
 * with no explanation just produces a support ticket.
 */
export default function AdminBusinesses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "pending");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ businesses: [], pages: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.businesses({
        status: status || undefined,
        q: debouncedQuery || undefined,
        page,
        limit: 10,
      });
      setData(result);
    } catch (requestError) {
      setError(requestError.message || "Could not load listings.");
    } finally {
      setLoading(false);
    }
  }, [status, debouncedQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi
      .overview()
      .then((result) => setCounts(result.totals))
      .catch(() => {});
  }, [data.total]);

  useEffect(() => {
    setSearchParams(status ? { status } : {}, { replace: true });
  }, [status, setSearchParams]);

  const decide = async () => {
    setWorking(true);
    try {
      await adminApi.decideBusiness(decision.business._id, decision.action, reason.trim() || undefined);
      toast.success(
        decision.action === "approve"
          ? "Approved and verified"
          : decision.action === "reject"
            ? "Rejected - the owner has been told why"
            : decision.action === "suspend"
              ? "Listing suspended"
              : "Listing restored"
      );
      setDecision(null);
      setReason("");
      await load();
    } catch (decisionError) {
      toast.error(decisionError.message || "Could not apply that decision");
    } finally {
      setWorking(false);
    }
  };

  const needsReason = decision && ["reject", "suspend"].includes(decision.action);

  return (
    <AdminLayout
      title="Listings"
      description={`${data.total} listing${data.total === 1 ? "" : "s"} in this view`}
      counts={counts}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="lf-no-scrollbar flex gap-1.5 overflow-x-auto">
          {FILTERS.map((filter) => (
            <button
              key={filter.key || "all"}
              type="button"
              onClick={() => {
                setStatus(filter.key);
                setPage(1);
              }}
              aria-pressed={status === filter.key}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                status === filter.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-muted hover:bg-slate-50"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or city"
            aria-label="Search listings"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink-soft placeholder:text-ink-faint focus:border-brand-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }, (unused, index) => (
            <Skeleton key={index} className="h-44 w-full rounded-card" />
          ))
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.businesses.length === 0 ? (
          <EmptyState
            icon={Store}
            title={status === "pending" ? "Nothing waiting for review" : "No listings here"}
            description={
              status === "pending"
                ? "The approval queue is empty. New submissions will appear here."
                : "Try a different filter or search term."
            }
            className="rounded-card border border-dashed border-line bg-surface"
          />
        ) : (
          data.businesses.map((business) => {
            const config = categoryConfig(business.category);
            const Icon = config.icon;
            const incomplete = [];
            if (!business.description) incomplete.push("no description");
            if (business.servicesCount === 0) incomplete.push("no services");
            if (!business.hoursSet) incomplete.push("no opening hours");
            if (business.gallery.length === 0) incomplete.push("no photos");

            return (
              <article key={business._id} className="rounded-card border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
                        business.logoUrl ? "" : config.tint
                      }`}
                    >
                      {business.logoUrl ? (
                        <img src={business.logoUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-sm font-bold text-ink">{business.name}</h2>
                        <Badge tone={STATUS_TONE[business.status]} size="xs">
                          {business.status}
                        </Badge>
                        {business.verified ? (
                          <Badge tone="success" size="xs" icon={BadgeCheck}>
                            Verified
                          </Badge>
                        ) : null}
                      </div>

                      <p className="mt-0.5 text-xs text-ink-muted">
                        {config.label}
                        {business.city ? ` · ${business.city}` : ""}
                        {business.submittedAt ? ` · submitted ${formatRelative(business.submittedAt)}` : ""}
                      </p>

                      <p className="mt-1 text-xs text-ink-faint">
                        Owner: {business.owner?.name} ({business.owner?.email})
                      </p>
                    </div>
                  </div>

                  {business.status === "approved" ? (
                    <Button
                      to={`/business/${business._id}`}
                      variant="ghost"
                      size="xs"
                      iconRight={ExternalLink}
                    >
                      View
                    </Button>
                  ) : null}
                </div>

                {business.description ? (
                  <p className="lf-line-clamp-2 mt-3 text-xs leading-relaxed text-ink-muted">
                    {business.description}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                  {business.addressLine ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" aria-hidden="true" />
                      {business.addressLine}
                    </span>
                  ) : null}
                  {business.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" aria-hidden="true" />
                      {business.phone}
                    </span>
                  ) : null}
                  {business.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" aria-hidden="true" />
                      {business.email}
                    </span>
                  ) : null}
                  {business.website ? (
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 hover:text-brand-700 hover:underline"
                    >
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      Website
                    </a>
                  ) : null}
                </div>

                {incomplete.length > 0 ? (
                  <p className="mt-2 text-xs text-warning-700">Incomplete: {incomplete.join(", ")}.</p>
                ) : null}

                {business.rejectionReason ? (
                  <p className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
                    Previous decision: {business.rejectionReason}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  {["pending", "rejected", "draft"].includes(business.status) ? (
                    <Button
                      variant="success"
                      size="xs"
                      icon={Check}
                      onClick={() => setDecision({ business, action: "approve" })}
                    >
                      Approve &amp; verify
                    </Button>
                  ) : null}

                  {["pending", "draft"].includes(business.status) ? (
                    <Button
                      variant="dangerGhost"
                      size="xs"
                      icon={X}
                      onClick={() => setDecision({ business, action: "reject" })}
                    >
                      Reject
                    </Button>
                  ) : null}

                  {business.status === "approved" ? (
                    <Button
                      variant="dangerGhost"
                      size="xs"
                      icon={ShieldOff}
                      onClick={() => setDecision({ business, action: "suspend" })}
                    >
                      Suspend
                    </Button>
                  ) : null}

                  {business.status === "suspended" ? (
                    <Button
                      variant="outline"
                      size="xs"
                      icon={Check}
                      onClick={() => setDecision({ business, action: "unsuspend" })}
                    >
                      Restore
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} className="mt-6" />

      <Modal
        open={Boolean(decision)}
        onClose={() => setDecision(null)}
        title={
          decision?.action === "approve"
            ? "Approve this listing?"
            : decision?.action === "reject"
              ? "Reject this listing"
              : decision?.action === "suspend"
                ? "Suspend this listing"
                : "Restore this listing?"
        }
        description={decision?.business?.name}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDecision(null)}>
              Cancel
            </Button>
            <Button
              variant={decision?.action === "approve" || decision?.action === "unsuspend" ? "success" : "danger"}
              onClick={decide}
              loading={working}
              disabled={needsReason && reason.trim().length < 3}
            >
              Confirm
            </Button>
          </>
        }
      >
        {decision?.action === "approve" ? (
          <p className="text-sm text-ink-muted">
            This publishes the listing in search and gives it the verified badge. The badge means a
            human checked it, so only approve what you have actually read.
          </p>
        ) : needsReason ? (
          <Textarea
            label="Reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            required
            hint="Shown to the owner, so say what they need to change."
            placeholder="e.g. The address does not match the pin on the map."
            data-autofocus
          />
        ) : (
          <p className="text-sm text-ink-muted">This makes the listing visible in search again.</p>
        )}
      </Modal>
    </AdminLayout>
  );
}
