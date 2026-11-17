import { z } from "zod";
import { objectIdSchema } from "./searchSchemas.js";
import { REPORT_STATUSES } from "../models/Report.js";
import { CONTACT_STATUSES } from "../models/Contact.js";

const pagination = {
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export const idParamSchema = z.object({ id: objectIdSchema });

export const listBusinessesSchema = z.object({
  ...pagination,
  status: z.enum(["draft", "pending", "approved", "rejected", "suspended"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export const decisionSchema = z.object({
  decision: z.enum(["approve", "reject", "suspend", "unsuspend"]),
  reason: z.string().trim().max(500).optional(),
});

export const listUsersSchema = z.object({
  ...pagination,
  role: z.enum(["customer", "owner", "admin"]).optional(),
  q: z.string().trim().max(120).optional(),
});

export const updateUserSchema = z
  .object({
    role: z.enum(["customer", "owner", "admin"]).optional(),
    isActive: z.boolean().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((value) => value.role !== undefined || value.isActive !== undefined, {
    message: "Nothing to update",
  });

export const listReviewsSchema = z.object({
  ...pagination,
  status: z.enum(["published", "hidden", "removed"]).optional(),
  reported: z.preprocess((value) => value === "true" || value === true, z.boolean()).default(false),
});

export const moderateReviewSchema = z.object({
  status: z.enum(["published", "hidden", "removed"]),
  note: z.string().trim().max(500).optional(),
});

export const listReportsSchema = z.object({
  ...pagination,
  status: z.enum(REPORT_STATUSES).optional(),
});

export const resolveReportSchema = z.object({
  status: z.enum(["reviewing", "resolved", "dismissed"]),
  resolution: z.string().trim().max(500).optional(),
});

export const listContactsSchema = z.object({
  ...pagination,
  status: z.enum(CONTACT_STATUSES).optional(),
});

export const updateContactSchema = z.object({
  status: z.enum(CONTACT_STATUSES),
  internalNote: z.string().trim().max(1000).optional(),
});

export const categorySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{2,30}$/, "Key must be lowercase letters, numbers, - or _"),
  label: z.string().trim().min(2).max(60),
  icon: z.string().trim().max(40).optional(),
  description: z.string().trim().max(300).optional(),
  order: z.coerce.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

export const updateCategorySchema = categorySchema.partial().omit({ key: true });

export const analyticsSchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});
