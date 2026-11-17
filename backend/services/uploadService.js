import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiResponse.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("upload");

/**
 * Image storage, behind one interface with two drivers.
 *
 * local      - writes under UPLOAD_DIR and serves from /uploads. Fine for
 *              development. Render's filesystem is ephemeral, so files
 *              written there disappear on the next deploy; the service
 *              warns about this rather than failing silently in a way
 *              that only shows up weeks later as broken images.
 * cloudinary - signed REST upload. No SDK: the signature is four lines of
 *              crypto, and one fewer dependency with access to our
 *              credentials is worth more than the convenience.
 *
 * Callers never know which is in use; both return an absolute URL.
 */

function randomName(ext) {
  return `${Date.now().toString(36)}-${crypto.randomBytes(8).toString("hex")}.${ext}`;
}

async function saveLocal(file, folder) {
  const directory = path.resolve(process.cwd(), env.uploadDir, folder);
  await fs.mkdir(directory, { recursive: true });

  const filename = randomName(file.detectedExt);
  await fs.writeFile(path.join(directory, filename), file.buffer);

  const base = env.publicUrl.replace(/\/$/, "");
  return {
    url: `${base}/uploads/${folder}/${filename}`,
    path: `${folder}/${filename}`,
    driver: "local",
  };
}

async function saveCloudinary(file, folder) {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  if (!cloudName || !apiKey || !apiSecret) {
    throw ApiError.badRequest("Image uploads are not configured on this server");
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadFolder = `${env.cloudinary.folder}/${folder}`;

  // Cloudinary signs the alphabetically-sorted parameter string plus the
  // API secret. The secret itself is never sent.
  const toSign = `folder=${uploadFolder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(`${toSign}${apiSecret}`).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.detectedMime }), randomName(file.detectedExt));
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", uploadFolder);
  form.append("signature", signature);

  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    form,
    { timeout: 30000 }
  );

  return {
    url: response.data.secure_url,
    path: response.data.public_id,
    driver: "cloudinary",
  };
}

/**
 * @param {Array} files   multer files that have already passed verifyImageBytes
 * @param {string} folder logical bucket: "review" | "business" | "avatar"
 */
export async function storeImages(files, folder = "misc") {
  const safeFolder = /^[a-z0-9_-]{1,30}$/.test(folder) ? folder : "misc";

  if (env.uploadDriver === "local" && env.isProduction) {
    log.warn(
      "UPLOAD_DRIVER=local in production - uploaded images will be lost on the next deploy. Configure Cloudinary."
    );
  }

  const results = [];
  for (const file of files) {
    try {
      results.push(
        env.uploadDriver === "cloudinary"
          ? await saveCloudinary(file, safeFolder)
          : await saveLocal(file, safeFolder)
      );
    } catch (error) {
      log.error(`could not store ${file.originalname}: ${error.message}`);
      throw error instanceof ApiError
        ? error
        : ApiError.badRequest("That image could not be saved. Please try again.");
    }
  }

  return results;
}

export default storeImages;
