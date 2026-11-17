import { storeImages } from "../services/uploadService.js";
import { created } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * POST /api/uploads/images
 *
 * Authenticated only: anonymous uploads are a storage bill and a content
 * liability waiting to happen. The folder is whitelisted inside the
 * service, so a caller cannot write outside the upload root.
 */
export const uploadImages = asyncHandler(async (req, res) => {
  const folder = ["review", "business", "avatar"].includes(req.body.folder) ? req.body.folder : "misc";
  const stored = await storeImages(req.files, folder);

  return created(res, {
    urls: stored.map((item) => item.url),
    files: stored,
  });
});

export default uploadImages;
