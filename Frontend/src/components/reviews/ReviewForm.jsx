import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ImagePlus, Trash2 } from "lucide-react";
import RatingStars from "./RatingStars";
import Button from "../common/Button";
import { Textarea } from "../common/Field";
import uploadApi from "../../services/uploadApi";

const MAX_PHOTOS = 5;

/**
 * Write or edit a review.
 *
 * Photos are uploaded as soon as they are chosen, so the review itself
 * posts with URLs and a slow connection cannot leave someone staring at
 * a stuck submit button. The form is the same for creating and editing;
 * passing `existing` switches the labels and prefills it.
 */
export default function ReviewForm({ placeId, placeName, lat, lng, existing = null, onSaved, onCancel }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [comment, setComment] = useState(existing?.comment || "");
  const [photos, setPhotos] = useState(existing?.photos || []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRating(existing?.rating || 0);
    setComment(existing?.comment || "");
    setPhotos(existing?.photos || []);
  }, [existing]);

  const addPhotos = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (files.length === 0) return;

    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.info(`You can attach up to ${MAX_PHOTOS} photos`);
      return;
    }

    setUploading(true);
    try {
      const uploaded = await uploadApi.images(files.slice(0, room), "review");
      setPhotos((current) => [...current, ...uploaded.urls]);
    } catch (uploadError) {
      toast.error(uploadError.message || "Could not upload that image");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (rating < 1) {
      setError("Choose a star rating first");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await onSaved({ placeId, placeName, rating, comment: comment.trim() || undefined, photos, lat, lng });
    } catch (saveError) {
      setError(saveError.message || "Could not save your review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="rounded-card border border-line bg-surface p-5">
      <h3 className="font-display text-sm font-bold text-ink">
        {existing ? "Edit your review" : `Review ${placeName}`}
      </h3>

      <div className="mt-3">
        <p className="mb-1.5 text-xs font-semibold text-ink-soft">Your rating</p>
        <RatingStars value={rating} onChange={setRating} size="lg" label="Your rating" />
      </div>

      <Textarea
        label="Your review"
        className="mt-4"
        rows={4}
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        maxLength={1500}
        placeholder="What was your experience like? What would you tell a friend?"
        hint={`${comment.length}/1500 — optional, but far more useful with a few words`}
      />

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold text-ink-soft">
          Photos <span className="font-normal text-ink-faint">(optional, up to {MAX_PHOTOS})</span>
        </p>

        <div className="flex flex-wrap gap-2">
          {photos.map((url) => (
            <div key={url} className="group relative h-16 w-16 overflow-hidden rounded-lg border border-line">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((item) => item !== url))}
                aria-label="Remove this photo"
                className="absolute inset-0 flex items-center justify-center bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              >
                <Trash2 className="h-4 w-4 text-white" aria-hidden="true" />
              </button>
            </div>
          ))}

          {photos.length < MAX_PHOTOS ? (
            <label
              className={`flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-brand-300 hover:text-brand-600 ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              <span className="text-[10px] font-semibold">{uploading ? "…" : "Add"}</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={addPhotos}
                disabled={uploading}
              />
            </label>
          ) : null}
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-xs font-medium text-danger-600">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-2">
        <Button type="submit" loading={submitting} disabled={uploading}>
          {existing ? "Save changes" : "Post review"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <p className="mt-3 text-2xs text-ink-faint">
        Reviews are public and show your name. Write about your own experience with this place.
      </p>
    </form>
  );
}
