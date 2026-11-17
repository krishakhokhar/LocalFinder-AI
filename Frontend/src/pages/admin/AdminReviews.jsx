import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { BadgeCheck, Eye, EyeOff, Flag, MessageSquare, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Pagination from "../../components/common/Pagination";
import Skeleton from "../../components/common/Skeleton";
import { Textarea } from "../../components/common/Field";
import RatingStars from "../../components/reviews/RatingStars";
import adminApi from "../../services/adminApi";
import { formatRelative } from "../../utils/format";

const FILTERS = [
  { key: "reported", label: "Reported" },
  { key: "published", label: "Published" },
  { key: "hidden", label: "Hidden" },
  { key: "removed", label: "Removed" },
  { key: "", label: "All" },
];

const STATUS_TONE = { published: "success", hidden: "warning", removed: "danger" };

/**
 * Review moderation.
 *
 * Hiding or removing a review recomputes the business's average
 * immediately, so a moderated review stops counting the moment it is
 * actioned. Reported reviews stay visible until a human decides -
 * auto-hiding on report count would hand anyone with a few accounts the
 * power to silence honest criticism.
 */
export default function AdminReviews() {
  const [filter, setFilter] = useState("reported");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ reviews: [], pages: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acting, setActing] = useState(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await adminApi.reviews({
          reported: filter === "reported" ? "true" : undefined,
          status: ["published", "hidden", "removed"].includes(filter) ? filter : undefined,
          page,
          limit: 15,
        })
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load reviews.");
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
  }, []);

  const moderate = async () => {
    setWorking(true);
    try {
      await adminApi.moderateReview(acting.review._id, {
        status: acting.status,
        note: note.trim() || undefined,
      });
      toast.success(
        acting.status === "published"
          ? "Review restored"
          : acting.status === "hidden"
            ? "Review hidden"
            : "Review removed"
      );
      setActing(null);
      setNote("");
      await load();
    } catch (moderateError) {
      toast.error(moderateError.message || "Could not moderate that review");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AdminLayout
      title="Reviews"
      description={`${data.total} review${data.total === 1 ? "" : "s"} in this view`}
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
          Array.from({ length: 5 }, (unused, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-card" />
          ))
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.reviews.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={filter === "reported" ? "Nothing has been reported" : "No reviews here"}
            description="The moderation queue is clear."
            className="rounded-card border border-dashed border-line bg-surface"
          />
        ) : (
          data.reviews.map((review) => (
            <article key={review._id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <RatingStars value={review.rating} size="xs" />
                    <Badge tone={STATUS_TONE[review.status]} size="xs">
                      {review.status}
                    </Badge>
                    {review.verifiedBooking ? (
                      <Badge tone="success" size="xs" icon={BadgeCheck}>
                        Verified booking
                      </Badge>
                    ) : null}
                    {review.reportCount > 0 ? (
                      <Badge tone="danger" size="xs" icon={Flag}>
                        {review.reportCount} report{review.reportCount === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-1.5 text-xs text-ink-muted">
                    <span className="font-semibold text-ink-soft">{review.author?.name}</span>
                    {review.author?.email ? ` (${review.author.email})` : ""} on{" "}
                    <span className="font-semibold text-ink-soft">{review.placeName}</span> ·{" "}
                    {formatRelative(review.createdAt)}
                  </p>
                </div>

                {review.businessId ? (
                  <Button to={`/business/${review.businessId}`} variant="ghost" size="xs">
                    View listing
                  </Button>
                ) : null}
              </div>

              {review.comment ? (
                <p className="mt-2.5 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-ink-soft">
                  {review.comment}
                </p>
              ) : (
                <p className="mt-2.5 text-xs italic text-ink-faint">Rating only, no written review.</p>
              )}

              {review.photos?.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {review.photos.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      loading="lazy"
                      className="h-16 w-16 rounded-lg border border-line object-cover"
                    />
                  ))}
                </div>
              ) : null}

              {review.moderationNote ? (
                <p className="mt-2 text-xs text-ink-faint">Moderator note: {review.moderationNote}</p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                {review.status !== "published" ? (
                  <Button
                    variant="outline"
                    size="xs"
                    icon={Eye}
                    onClick={() => setActing({ review, status: "published" })}
                  >
                    Restore
                  </Button>
                ) : null}
                {review.status !== "hidden" ? (
                  <Button
                    variant="outline"
                    size="xs"
                    icon={EyeOff}
                    onClick={() => setActing({ review, status: "hidden" })}
                  >
                    Hide
                  </Button>
                ) : null}
                {review.status !== "removed" ? (
                  <Button
                    variant="dangerGhost"
                    size="xs"
                    icon={Trash2}
                    onClick={() => setActing({ review, status: "removed" })}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} className="mt-6" />

      <Modal
        open={Boolean(acting)}
        onClose={() => setActing(null)}
        title={
          acting?.status === "published"
            ? "Restore this review?"
            : acting?.status === "hidden"
              ? "Hide this review?"
              : "Remove this review?"
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setActing(null)}>
              Cancel
            </Button>
            <Button
              variant={acting?.status === "published" ? "success" : "danger"}
              onClick={moderate}
              loading={working}
            >
              Confirm
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {acting?.status === "published"
            ? "It becomes visible again and counts towards the rating."
            : "It stops counting towards the business's rating immediately."}
        </p>
        <Textarea
          label="Internal note"
          className="mt-4"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          hint={
            acting?.status === "removed"
              ? "The author is told their review was removed, along with this note."
              : "Kept for the moderation record."
          }
        />
      </Modal>
    </AdminLayout>
  );
}
