import { useState } from "react";
import { toast } from "react-toastify";
import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import uploadApi from "../../services/uploadApi";

/**
 * Logo and gallery uploader.
 *
 * Images upload the moment they are chosen, so the listing form submits
 * URLs rather than megabytes and a slow connection cannot leave someone
 * staring at a stuck Save button.
 */
export default function ImageUploader({
  value = [],
  onChange,
  max = 8,
  folder = "business",
  label = "Photos",
  hint,
  single = false,
}) {
  const [uploading, setUploading] = useState(false);
  const images = single ? (value ? [value] : []) : value;

  const handleFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (files.length === 0) return;

    const room = single ? 1 : max - images.length;
    if (room <= 0) {
      toast.info(`You can upload up to ${max} images`);
      return;
    }

    setUploading(true);
    try {
      const result = await uploadApi.images(files.slice(0, room), folder);
      onChange(single ? result.urls[0] : [...images, ...result.urls]);
    } catch (error) {
      toast.error(error.message || "Could not upload that image");
    } finally {
      setUploading(false);
    }
  };

  const remove = (url) => {
    onChange(single ? null : images.filter((item) => item !== url));
  };

  const makeCover = (url) => {
    if (single) return;
    onChange([url, ...images.filter((item) => item !== url)]);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-soft">{label}</p>

      <div className="flex flex-wrap gap-2.5">
        {images.map((url, index) => (
          <div
            key={url}
            className={`group relative overflow-hidden rounded-card border border-line ${
              single ? "h-24 w-24" : "h-24 w-32"
            }`}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />

            {!single && index === 0 ? (
              <span className="absolute left-1.5 top-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                Cover
              </span>
            ) : null}

            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-ink/60 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {!single && index !== 0 ? (
                <button
                  type="button"
                  onClick={() => makeCover(url)}
                  aria-label="Use as cover photo"
                  title="Use as cover photo"
                  className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-white/30"
                >
                  <Star className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => remove(url)}
                aria-label="Remove this image"
                className="rounded-lg bg-white/15 p-1.5 text-white transition-colors hover:bg-danger-500"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {images.length < (single ? 1 : max) ? (
          <label
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line text-ink-faint transition-colors hover:border-brand-300 hover:text-brand-600 ${
              single ? "h-24 w-24" : "h-24 w-32"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-5 w-5" aria-hidden="true" />
            )}
            <span className="text-xs font-semibold">{uploading ? "Uploading" : "Add"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple={!single}
              className="sr-only"
              onChange={handleFiles}
              disabled={uploading}
            />
          </label>
        ) : null}
      </div>

      <p className="mt-1.5 text-xs text-ink-faint">
        {hint || `JPG, PNG or WebP, up to 3 MB each. ${single ? "" : "The first image is used as the cover."}`}
      </p>
    </div>
  );
}
