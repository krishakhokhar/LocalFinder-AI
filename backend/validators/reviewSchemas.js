import { z } from "zod";
import { latSchema, lngSchema, objectIdSchema, placeIdSchema } from "./searchSchemas.js";
import { REPORT_REASONS } from "../models/Report.js";

export const createReviewSchema = z.object({
  placeId: placeIdSchema,
  placeName: z.string().trim().min(1, "placeName is required").max(140),
  rating: z.coerce
    .number()
    .int("Pick a whole number of stars")
    .min(1, "Pick between 1 and 5 stars")
    .max(5, "Pick between 1 and 5 stars"),
  comment: z.string().trim().max(1500, "Keep your review under 1500 characters").optional(),
  photos: z.array(z.string().trim().max(500)).max(5, "At most 5 photos").optional(),
  lat: latSchema.optional(),
  lng: lngSchema.optional(),
});

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    comment: z.string().trim().max(1500).optional(),
    photos: z.array(z.string().trim().max(500)).max(5).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const reportReviewSchema = z.object({
  reason: z.enum(REPORT_REASONS, { message: "Pick a reason" }),
  details: z.string().trim().max(1000).optional(),
});

export const reviewIdParamSchema = z.object({ id: objectIdSchema });
export const placeIdParamSchema = z.object({ placeId: placeIdSchema });

export const listReviewsSchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  sort: z.enum(["recent", "highest", "lowest"]).default("recent"),
});

export const summaryQuerySchema = z.object({
  placeIds: z.string().trim().min(1, "placeIds is required").max(8000),
});
