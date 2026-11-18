import { z } from "zod";
import { MIN_RADIUS_M, MAX_RADIUS_M, DEFAULT_RADIUS_M } from "../utils/overpass.js";

/** Query strings arrive as text; these coerce once, at the edge. */
const numeric = (schema) => z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
}, schema);

const boolish = z.preprocess((value) => {
  if (value === undefined || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
}, z.boolean().optional());

export const latSchema = numeric(
  z.number({ message: "lat must be a number" }).min(-90, "lat must be between -90 and 90").max(90, "lat must be between -90 and 90")
);

export const lngSchema = numeric(
  z.number({ message: "lng must be a number" }).min(-180, "lng must be between -180 and 180").max(180, "lng must be between -180 and 180")
);

export const nearbySearchSchema = z.object({
  lat: latSchema,
  lng: lngSchema,
  // `type` was the original parameter name and still works.
  category: z.string().trim().toLowerCase().max(30).optional(),
  type: z.string().trim().toLowerCase().max(30).optional(),
  radius: numeric(
    z
      .number()
      .min(MIN_RADIUS_M, `radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`)
      .max(MAX_RADIUS_M, `radius must be between ${MIN_RADIUS_M} and ${MAX_RADIUS_M}`)
  )
    .optional()
    .default(DEFAULT_RADIUS_M),
  q: z.string().trim().max(120).optional().default(""),
  openNow: boolish,
  minRating: numeric(z.number().min(0).max(5)).optional().default(0),
  maxPrice: numeric(z.number().min(0).max(10000000)).optional(),
  sort: z
    .enum(["distance", "rating", "relevance", "price", "reviews"])
    .optional()
    .default("distance"),
  // Which dataset to draw from. `includeExternal=false` is the older way of
  // saying `source=registered` and still works.
  source: z.enum(["all", "registered", "osm"]).optional().default("all"),
  page: numeric(z.number().int().min(1).max(100)).optional().default(1),
  limit: numeric(z.number().int().min(1).max(50)).optional().default(20),
  // Minutes east of UTC, as the browser knows it. Used to evaluate opening
  // hours in the viewer's local time rather than the server's.
  tz: numeric(z.number().int().min(-840).max(840)).optional().default(0),
  includeExternal: boolish,
  // Explicit consent to widen past the requested radius.
  autoExpand: boolish,
});

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, "Invalid id");

export const placeIdSchema = z.string().trim().min(1, "placeId is required").max(300);
