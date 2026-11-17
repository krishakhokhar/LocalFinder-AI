import multer from "multer";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiResponse.js";

/**
 * Image upload handling.
 *
 * Files are held in memory, never written to disk before they have been
 * checked - a path on disk is a path that can be served, and a file
 * should not reach one until we know what it is.
 *
 * Two independent checks run on every file:
 *
 *  1. The declared MIME type and extension must be in the allow-list.
 *     This is cheap but entirely attacker-controlled, so it is only a
 *     first filter.
 *  2. The actual bytes must start with a known image signature. This is
 *     what stops `payload.php` being uploaded as `photo.jpg` with a
 *     forged Content-Type - the one that actually matters.
 */

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ALLOWED_EXTENSION = /\.(jpe?g|png|webp)$/i;

/** First bytes of each format we accept. */
const SIGNATURES = [
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

function matches(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}

/** @returns {{ext:string, mime:string}|null} */
export function sniffImage(buffer) {
  for (const signature of SIGNATURES) {
    if (matches(buffer, signature.bytes)) return { ext: signature.ext, mime: signature.mime };
  }
  // WEBP: "RIFF" .... "WEBP"
  if (
    matches(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    matches(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return { ext: "webp", mime: "image/webp" };
  }
  return null;
}

export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.maxUploadBytes,
    files: 6,
    fields: 10,
    // Without this a crafted multipart body can exhaust memory on field
    // names alone.
    fieldNameSize: 100,
  },
  fileFilter: (req, file, callback) => {
    if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXTENSION.test(file.originalname || "")) {
      callback(ApiError.badRequest("Only JPG, PNG and WebP images are allowed"));
      return;
    }
    callback(null, true);
  },
});

/**
 * Runs after multer: rejects anything whose bytes do not match a real
 * image header, and replaces the client-declared type with the sniffed
 * one so nothing downstream trusts the upload's own claim about itself.
 */
export function verifyImageBytes(req, res, next) {
  const files = req.files || (req.file ? [req.file] : []);

  for (const file of files) {
    const sniffed = sniffImage(file.buffer);
    if (!sniffed) {
      return next(
        ApiError.badRequest(
          `"${file.originalname}" is not a valid JPG, PNG or WebP image.`
        )
      );
    }
    file.detectedMime = sniffed.mime;
    file.detectedExt = sniffed.ext;
  }

  if (files.length === 0) {
    return next(ApiError.badRequest("No image was uploaded"));
  }

  next();
}
