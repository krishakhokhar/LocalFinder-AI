import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { CheckCircle2, Flag, ShieldCheck, XCircle } from "lucide-react";
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
import { formatRelative } from "../../utils/format";

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "reviewing", label: "Reviewing" },
  { key: "resolved", label: "Resolved" },
  { key: "dismissed", label: "Dismissed" },
  { key: "", label: "All" },
];

const REASON_LABELS = {
  spam: "Spam or advertising",
  offensive: "Offensive or abusive",
  fake: "Fake or not a real experience",
  wrong_information: "Wrong information",
  not_a_real_business: "Not a real business",
  other: "Other",
};

const STATUS_TONE = { open: "danger", reviewing: "warning", resolved: "success", dismissed: "neutral" };

export default function AdminReports() {
  const [filter, setFilter] = useState("open");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reports: [], pages: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(null);
  const [resolution, setResolution] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.reports({ status: filter || undefined, page, limit: 20 }));
    } catch (requestError) {
      setError(requestError.message || "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi
      .overview()
      .then((result) => setCounts(result.totals))
      .catch(() => {});
  }, [data.total]);

  const resolve = async () => {
    setWorking(true);
    try {
      await adminApi.resolveReport(acting.report._id, {
        status: acting.status,
        resolution: resolution.trim() || undefined,
      });
      toast.success("Report updated");
      setActing(null);
      setResolution("");
      await load();
    } catch (resolveError) {
      toast.error(resolveError.message || "Could not update that report");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AdminLayout
      title="Reports"
      description="Things users have flagged for a human to look at."
      counts={counts}
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key || "all"}
            type="button"
            onClick={() => {
              setFilter(item.key);
              setPage(1);
            }}
            aria-pressed={filter === item.key}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === item.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-muted hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }, (unused, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.reports.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Nothing to moderate"
            description="No reports in this view."
            className="rounded-card border border-dashed border-line bg-surface"
          />
        ) : (
          data.reports.map((report) => (
            <article key={report._id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[report.status]} size="xs" icon={Flag}>
                      {report.status}
                    </Badge>
                    <Badge tone="neutral" size="xs">
                      {REASON_LABELS[report.reason] || report.reason}
                    </Badge>
                    <span className="text-xs text-ink-faint">{formatRelative(report.createdAt)}</span>
                  </div>

                  <p className="mt-1.5 text-sm font-semibold text-ink">
                    {report.targetLabel || `${report.targetType} ${report.targetId}`}
                  </p>
                  <p className="text-xs text-ink-muted">
                    Reported by {report.reporter?.name || "a user"}
                    {report.reporter?.email ? ` (${report.reporter.email})` : ""}
                  </p>
                </div>
              </div>

              {report.details ? (
                <p className="mt-2.5 rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-ink-soft">
                  {report.details}
                </p>
              ) : null}

              {report.resolution ? (
                <p className="mt-2 text-xs text-ink-faint">Outcome: {report.resolution}</p>
              ) : null}

              {["open", "reviewing"].includes(report.status) ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button
                    variant="success"
                    size="xs"
                    icon={CheckCircle2}
                    onClick={() => setActing({ report, status: "resolved" })}
                  >
                    Mark resolved
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    icon={XCircle}
                    onClick={() => setActing({ report, status: "dismissed" })}
                  >
                    Dismiss
                  </Button>
                  {report.targetType === "review" ? (
                    <Button to="/admin/reviews" variant="ghost" size="xs">
                      Open review queue
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} className="mt-6" />

      <Modal
        open={Boolean(acting)}
        onClose={() => setActing(null)}
        title={acting?.status === "resolved" ? "Mark as resolved" : "Dismiss this report"}
        description={
          acting?.status === "resolved"
            ? "Use this once you have actually acted on it."
            : "Use this when the report does not need action."
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActing(null)}>
              Cancel
            </Button>
            <Button
              variant={acting?.status === "resolved" ? "success" : "primary"}
              onClick={resolve}
              loading={working}
            >
              Confirm
            </Button>
          </>
        }
      >
        <Textarea
          label="What did you do?"
          rows={3}
          value={resolution}
          onChange={(event) => setResolution(event.target.value)}
          maxLength={500}
          hint="Kept on the record. The reporter is notified that their report was handled."
          data-autofocus
        />
      </Modal>
    </AdminLayout>
  );
}
