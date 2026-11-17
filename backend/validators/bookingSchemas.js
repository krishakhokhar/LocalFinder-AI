import { z } from "zod";
import { objectIdSchema } from "./searchSchemas.js";

const tzSchema = z.coerce.number().int().min(-840).max(840).optional().default(0);

export const availabilitySchema = z.object({
  businessId: objectIdSchema,
  serviceId: objectIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  tz: tzSchema,
});

export const createBookingSchema = z.object({
  businessId: objectIdSchema,
  serviceId: objectIdSchema,
  startAt: z.string().datetime({ message: "startAt must be an ISO timestamp" }),
  note: z.string().trim().max(500).optional(),
  contact: z
    .object({
      name: z.string().trim().max(100).optional(),
      phone: z.string().trim().max(20).optional(),
      email: z.string().trim().toLowerCase().max(120).optional(),
    })
    .optional(),
  tz: tzSchema,
});

export const rescheduleSchema = z.object({
  startAt: z.string().datetime({ message: "startAt must be an ISO timestamp" }),
  tz: tzSchema,
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export const statusSchema = z.object({
  status: z.enum(["confirmed", "rejected", "cancelled", "completed"], {
    message: "status must be confirmed, rejected, cancelled or completed",
  }),
  note: z.string().trim().max(500).optional(),
});

export const bookingIdParamSchema = z.object({ id: objectIdSchema });

export const myBookingsSchema = z.object({
  scope: z.enum(["upcoming", "past", "all"]).default("upcoming"),
});

export const businessBookingsSchema = z.object({
  scope: z.enum(["upcoming", "today", "past", "all"]).default("upcoming"),
  status: z.enum(["pending", "confirmed", "rejected", "cancelled", "completed"]).optional(),
});
