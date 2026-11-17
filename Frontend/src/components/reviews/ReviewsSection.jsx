import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { MessageSquarePlus, Star } from "lucide-react";
import RatingSummary from "./RatingSummary";
import ReviewList from "./ReviewList";
import ReviewForm from "./ReviewForm";
import Button from "../common/Button";
import Pagination from "../common/Pagination";
import Modal from "../common/Modal";
import Skeleton from "../common/Skeleton";
import reviewApi from "../../services/reviewApi";
import { useAuth } from "../../context/AuthContext";

/**
 * The complete reviews block for a place.
 *
 * Works for OpenStreetMap places as well as registered businesses: both
 * are identified by `placeId`, so the first genuine rating a map place
 * ever gets comes from a LocalFinder user who went there.
 */
export default function ReviewsSection({ placeId, placeName, lat, lng, onSummaryChange }) {
  const { isAuthenticated, user } = useAuth();

  const [state, setState] = useState({ reviews: [], summary: null, myReview: null, pages: 1 });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("recent");
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [ownership, setOwnership] = useState({ isOwner: false });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await reviewApi.listForPlace(placeId, { page, limit: 10, sort });
      setState({
        reviews: data.reviews,
        summary: data.summary,
        myReview: data.myReview,
        pages: data.pages,
      });
      onSummaryChange?.(data.summary);
    } catch {
      // Reviews are additive to the page; a failure here should not take
      // the whole listing down.
    } finally {
      setLoading(false);
    }
  }, [placeId, page, sort, onSummaryChange]);

  useEffect(() => {
    load();
  }, [load]);

  // Owners cannot review their own business; ask the server rather than
  // inferring it in the browser.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let active = true;
    reviewApi
      .canReview(placeId)
      .then((data) => active && setOwnership(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [isAuthenticated, placeId]);

  const save = async (payload) => {
    if (editing) {
      await reviewApi.update(editing._id, {
        rating: payload.rating,
        comment: payload.comment ?? "",
        photos: payload.photos,
      });
      toast.success("Review updated");
    } else {
      await reviewApi.create(payload);
      toast.success("Thanks for your review");
    }
    setFormOpen(false);
    setEditing(null);
    await load();
  };

  const remove = async () => {
    try {
      await reviewApi.remove(confirmDelete._id);
      toast.success("Review deleted");
      setConfirmDelete(null);
      await load();
    } catch (error) {
      toast.error(error.message || "Could not delete that review");
    }
  };

  const report = async (review, payload) => {
    try {
      await reviewApi.report(review._id, payload);
      toast.success("Report submitted. Thanks for flagging it.");
    } catch (error) {
      toast.error(error.message || "Could not submit that report");
    }
  };

  const canWrite = isAuthenticated && !state.myReview && !ownership.isOwner;

  return (
    <section className="mt-9" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="font-display text-base font-bold text-ink">
          Reviews
          {state.summary?.count ? (
            <span className="ml-2 font-sans text-sm font-normal text-ink-muted">
              ({state.summary.count})
            </span>
          ) : null}
        </h2>

        <div className="flex items-center gap-2">
          {state.summary?.count > 1 ? (
            <label className="flex items-center gap-1.5">
              <span className="sr-only">Sort reviews</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-line bg-surface pl-2 pr-7 text-xs font-semibold text-ink-soft focus:border-brand-600 focus:outline-none"
              >
                <option value="recent">Most recent</option>
                <option value="highest">Highest rated</option>
                <option value="lowest">Lowest rated</option>
              </select>
            </label>
          ) : null}

          {canWrite ? (
            <Button size="sm" icon={MessageSquarePlus} onClick={() => setFormOpen(true)}>
              Write a review
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        {loading && !state.summary ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-card" />
            <Skeleton className="h-20 w-full rounded-card" />
          </div>
        ) : (
          <>
            <RatingSummary
              rating={state.summary?.rating}
              count={state.summary?.count || 0}
              distribution={state.summary?.distribution}
            />

            {!isAuthenticated ? (
              <p className="mt-3 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
                <Button to="/auth" variant="ghost" size="xs" className="-ml-2 mr-1">
                  Sign in
                </Button>
                to write a review.
              </p>
            ) : ownership.isOwner ? (
              <p className="mt-3 rounded-card border border-line bg-surface px-4 py-3 text-sm text-ink-muted">
                You own this listing, so you cannot review it.
              </p>
            ) : null}

            {state.myReview ? (
              <div className="mt-4 rounded-card border border-brand-200 bg-brand-50/40 p-1">
                <p className="px-4 pt-3 text-xs font-bold uppercase tracking-wider text-brand-700">
                  Your review
                </p>
                <div className="px-4">
                  <ReviewList
                    reviews={[state.myReview]}
                    onEdit={(review) => {
                      setEditing(review);
                      setFormOpen(true);
                    }}
                    onDelete={setConfirmDelete}
                    onReport={report}
                  />
                </div>
              </div>
            ) : null}

            {state.reviews.filter((review) => !review.isMine).length > 0 ? (
              <ReviewList
                reviews={state.reviews.filter((review) => !review.isMine)}
                onEdit={(review) => {
                  setEditing(review);
                  setFormOpen(true);
                }}
                onDelete={setConfirmDelete}
                onReport={report}
              />
            ) : state.summary?.count === 0 && canWrite ? (
              <div className="mt-4 rounded-card border border-dashed border-line bg-surface p-6 text-center">
                <Star className="mx-auto h-5 w-5 text-warning-500" aria-hidden="true" />
                <p className="mt-2 text-sm font-semibold text-ink">Be the first to review</p>
                <Button size="sm" className="mt-3" onClick={() => setFormOpen(true)}>
                  Write a review
                </Button>
              </div>
            ) : null}

            <Pagination page={page} pages={state.pages} onChange={setPage} className="mt-5" />
          </>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? "Edit your review" : `Review ${placeName}`}
        size="md"
      >
        <ReviewForm
          placeId={placeId}
          placeName={placeName}
          lat={lat}
          lng={lng}
          existing={editing}
          onSaved={save}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete your review?"
        description="This cannot be undone, and the place's rating will be recalculated."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete review
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          {user?.name}, your {confirmDelete?.rating}-star review will be removed from this listing.
        </p>
      </Modal>
    </section>
  );
}
