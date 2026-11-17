import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Flag, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import RatingStars from "./RatingStars";
import Avatar from "../common/Avatar";
import Modal from "../common/Modal";
import Button from "../common/Button";
import { Select, Textarea } from "../common/Field";
import useMotionSafe from "../../hooks/useMotionSafe";
import { formatRelative } from "../../utils/format";

const REPORT_REASONS = [
  { value: "spam", label: "Spam or advertising" },
  { value: "offensive", label: "Offensive or abusive" },
  { value: "fake", label: "Fake or not a real experience" },
  { value: "wrong_information", label: "Wrong information" },
  { value: "other", label: "Something else" },
];

function ReviewItem({ review, onEdit, onDelete, onReport, index }) {
  const { reduce } = useMotionSafe();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  return (
    <motion.li
      initial={reduce ? { opacity: 1 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduce ? 0 : Math.min(index * 0.04, 0.3), duration: 0.3 }}
      className="border-b border-line py-5 last:border-0"
    >
      <div className="flex items-start gap-3">
        <Avatar name={review.author.name} src={review.author.avatarUrl} size="sm" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold text-ink">{review.author.name}</span>
            {review.isMine ? (
              <span className="rounded bg-brand-50 px-1.5 py-0.5 text-2xs font-bold text-brand-700">You</span>
            ) : null}
            {review.verifiedBooking ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2 py-0.5 text-2xs font-bold text-success-700">
                <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                Verified booking
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <RatingStars value={review.rating} size="xs" />
            <span className="text-xs text-ink-faint">
              {formatRelative(review.createdAt)}
              {review.editedAt ? " · edited" : ""}
            </span>
          </div>

          {review.comment ? (
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{review.comment}</p>
          ) : null}

          {review.photos?.length > 0 ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {review.photos.map((url) => (
                <button
                  key={url}
                  type="button"
                  onClick={() => setLightbox(url)}
                  className="h-16 w-16 overflow-hidden rounded-lg border border-line transition-transform hover:scale-105"
                >
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Review options"
            aria-expanded={menuOpen}
            className="rounded-lg p-1.5 text-ink-faint transition-colors hover:bg-slate-100 hover:text-ink"
          >
            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setMenuOpen(false)}
                />
                <motion.div
                  initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.96, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lift"
                >
                  {review.isMine ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onEdit(review);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit review
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onDelete(review);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-danger-600 transition-colors hover:bg-danger-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete review
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onReport(review);
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-soft transition-colors hover:bg-slate-50"
                    >
                      <Flag className="h-3.5 w-3.5" aria-hidden="true" />
                      Report review
                    </button>
                  )}
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      <Modal open={Boolean(lightbox)} onClose={() => setLightbox(null)} title="Review photo" size="lg">
        {lightbox ? <img src={lightbox} alt="" className="mx-auto max-h-[70vh] rounded-card" /> : null}
      </Modal>
    </motion.li>
  );
}

export default function ReviewList({ reviews, onEdit, onDelete, onReport }) {
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submitReport = async () => {
    setSubmitting(true);
    try {
      await onReport(reporting, { reason, details: details.trim() || undefined });
      setReporting(null);
      setDetails("");
      setReason("spam");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ul className="divide-y divide-line">
        {reviews.map((review, index) => (
          <ReviewItem
            key={review._id}
            review={review}
            index={index}
            onEdit={onEdit}
            onDelete={onDelete}
            onReport={setReporting}
          />
        ))}
      </ul>

      <Modal
        open={Boolean(reporting)}
        onClose={() => setReporting(null)}
        title="Report this review"
        description="A moderator will look at it. The review stays visible until they decide."
        footer={
          <>
            <Button variant="ghost" onClick={() => setReporting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReport} loading={submitting}>
              Submit report
            </Button>
          </>
        }
      >
        <Select
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          options={REPORT_REASONS}
          data-autofocus
        />
        <Textarea
          label="Anything else?"
          className="mt-4"
          rows={3}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          maxLength={1000}
          placeholder="Optional context that would help a moderator"
        />
      </Modal>
    </>
  );
}
