import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import useMotionSafe from "../../hooks/useMotionSafe";
import { categoryConfig } from "../../utils/categories";

/**
 * Photo gallery for a business.
 *
 * Only ever shows images the owner actually uploaded. When there are
 * none, it falls back to a category tile rather than a stock photograph -
 * a generic picture of *a* salon on *this* salon's page is a small lie
 * that makes every other claim on the page less trustworthy.
 */
export default function BusinessGallery({ images = [], name, category, className = "" }) {
  const { reduce } = useMotionSafe();
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const config = categoryConfig(category);
  const Icon = config.icon;

  if (images.length === 0) {
    return (
      <div
        className={`flex h-52 items-center justify-center rounded-card border border-line sm:h-64 ${config.tint} ${className}`}
      >
        <div className="text-center">
          <Icon className="mx-auto h-10 w-10 opacity-60" aria-hidden="true" />
          <p className="mt-2 flex items-center justify-center gap-1.5 text-xs font-medium opacity-70">
            <ImageOff className="h-3 w-3" aria-hidden="true" />
            No photos yet
          </p>
        </div>
      </div>
    );
  }

  const show = (index) => setLightboxIndex((index + images.length) % images.length);

  return (
    <>
      <div className={`grid gap-2 ${images.length > 1 ? "sm:grid-cols-[2fr_1fr]" : ""} ${className}`}>
        <button
          type="button"
          onClick={() => show(0)}
          className="group relative h-52 overflow-hidden rounded-card border border-line sm:h-64"
          aria-label={`View photo 1 of ${images.length} for ${name}`}
        >
          <img
            src={images[0]}
            alt={`${name}`}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        </button>

        {images.length > 1 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-1">
            {images.slice(1, 3).map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => show(index + 1)}
                className="group relative h-24 overflow-hidden rounded-card border border-line sm:h-[7.75rem]"
                aria-label={`View photo ${index + 2} of ${images.length}`}
              >
                <img
                  src={image}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                />
                {index === 1 && images.length > 3 ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink/55 font-display text-sm font-bold text-white">
                    +{images.length - 3} more
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {lightboxIndex !== null ? (
          <motion.div
            initial={reduce ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink/90 p-4"
            onClick={() => setLightboxIndex(null)}
            role="dialog"
            aria-modal="true"
            aria-label={`Photo ${lightboxIndex + 1} of ${images.length}`}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close gallery"
              className="absolute right-4 top-4 rounded-lg p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>

            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    show(lightboxIndex - 1);
                  }}
                  aria-label="Previous photo"
                  className="absolute left-3 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    show(lightboxIndex + 1);
                  }}
                  aria-label="Next photo"
                  className="absolute right-3 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            ) : null}

            <motion.img
              key={lightboxIndex}
              initial={reduce ? { opacity: 1 } : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              src={images[lightboxIndex]}
              alt={`${name} photo ${lightboxIndex + 1}`}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[85vh] max-w-full rounded-card object-contain"
            />

            <p className="absolute bottom-5 text-xs font-medium text-white/70">
              {lightboxIndex + 1} / {images.length}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
