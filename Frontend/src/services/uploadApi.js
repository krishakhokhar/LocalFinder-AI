import { request } from "./apiClient";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Image uploads.
 *
 * Size and type are checked here too, so an obviously-too-large file
 * fails instantly instead of after a slow upload that the server will
 * reject anyway. The server repeats both checks and inspects the actual
 * bytes - this is convenience, not security.
 */
export const uploadApi = {
  async images(files, folder = "misc") {
    const list = [...files];

    for (const file of list) {
      if (!ALLOWED.includes(file.type)) {
        throw new Error(`"${file.name}" is not a JPG, PNG or WebP image.`);
      }
      if (file.size > MAX_BYTES) {
        throw new Error(`"${file.name}" is larger than 3 MB. Please choose a smaller image.`);
      }
    }

    const form = new FormData();
    list.forEach((file) => form.append("images", file));
    form.append("folder", folder);

    return request("/api/uploads/images", { method: "POST", body: form });
  },
};

export default uploadApi;
