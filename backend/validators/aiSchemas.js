import { z } from "zod";
import { latSchema, lngSchema, placeIdSchema } from "./searchSchemas.js";

/**
 * Conversation history is supplied by the client and is therefore
 * untrusted input: it is length-capped on both the number of turns and
 * the size of each turn, so it cannot be used to stuff the model's
 * context or run up token costs.
 */
const historyEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().max(600),
});

export const aiSearchSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Type a message first")
    .max(500, "Please keep your message under 500 characters"),
  lat: latSchema.optional().nullable(),
  lng: lngSchema.optional().nullable(),
  history: z.array(historyEntrySchema).max(8).optional().default([]),
  tz: z.coerce.number().int().min(-840).max(840).optional().default(0),
});

export const aiCompareSchema = z.object({
  placeIds: z.array(placeIdSchema).min(2, "Pick at least two places").max(4, "Compare at most four places"),
  lat: latSchema,
  lng: lngSchema,
  category: z.string().trim().toLowerCase().max(30).optional(),
  radius: z.coerce.number().int().min(100).max(20000).optional(),
  language: z.enum(["en", "hi", "gu"]).optional().default("en"),
  tz: z.coerce.number().int().min(-840).max(840).optional().default(0),
});
