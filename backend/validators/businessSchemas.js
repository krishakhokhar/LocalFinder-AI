import { z } from "zod";
import { latSchema, lngSchema, objectIdSchema } from "./searchSchemas.js";

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Service name is required").max(120),
  description: z.string().trim().max(500).optional(),
  durationMinutes: z.coerce
    .number()
    .int()
    .min(5, "A service must take at least 5 minutes")
    .max(600, "A service cannot take more than 10 hours")
    .default(30),
  // Explicitly nullable: "no price published" is a real, valid state and
  // must never be coerced into 0.
  price: z.coerce.number().min(0).max(10000000).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().default("INR"),
  active: z.boolean().default(true),
});

export const openingHoursSchema = z
  .array(
    z
      .object({
        day: z.coerce.number().int().min(0).max(6),
        closed: z.boolean().default(false),
        open: z.string().regex(HHMM, "Opening time must be HH:MM").default("09:00"),
        close: z.string().regex(HHMM, "Closing time must be HH:MM").default("18:00"),
      })
      .refine((row) => row.closed || row.open !== row.close, {
        message: "Opening and closing time cannot be identical",
      })
  )
  .length(7, "Provide one row for each day of the week");

const addressSchema = z.object({
  line1: z.string().trim().max(200).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(12).optional(),
  country: z.string().trim().max(80).default("India"),
});

export const createBusinessSchema = z.object({
  name: z.string().trim().min(2, "Business name is required").max(140),
  category: z.string().trim().toLowerCase().min(2, "Pick a category").max(30),
  description: z.string().trim().max(2000).optional(),
  phone: z.string().trim().max(20).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120).optional().or(z.literal("")),
  website: z.string().trim().url("Enter a full URL including https://").max(300).optional().or(z.literal("")),
  address: addressSchema,
  lat: latSchema,
  lng: lngSchema,
  logoUrl: z.string().trim().max(500).optional(),
  gallery: z.array(z.string().trim().max(500)).max(12).optional(),
  openingHours: openingHoursSchema.optional(),
  services: z.array(serviceSchema).max(30).optional(),
  amenities: z.array(z.string().trim().max(40)).max(20).optional(),
  priceRange: z.coerce.number().int().min(1).max(4).nullable().optional(),
  acceptsBookings: z.boolean().optional(),
});

/** Every field optional, but at least one must be present. */
export const updateBusinessSchema = createBusinessSchema
  .partial()
  .extend({ address: addressSchema.partial().optional() })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const bookingSettingsSchema = z.object({
  slotMinutes: z.coerce.number().int().min(10).max(240).optional(),
  leadTimeMinutes: z.coerce.number().int().min(0).max(10080).optional(),
  maxAdvanceDays: z.coerce.number().int().min(1).max(180).optional(),
  capacityPerSlot: z.coerce.number().int().min(1).max(20).optional(),
  autoConfirm: z.boolean().optional(),
  acceptsBookings: z.boolean().optional(),
});

export const businessIdParamSchema = z.object({ id: objectIdSchema });

export const serviceIdParamSchema = z.object({
  id: objectIdSchema,
  serviceId: objectIdSchema,
});

export const listBusinessesSchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().trim().toLowerCase().max(30).optional(),
  city: z.string().trim().max(100).optional(),
  status: z.enum(["draft", "pending", "approved", "rejected", "suspended"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["recent", "rating", "name", "views"]).default("recent"),
});
