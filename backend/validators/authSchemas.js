import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Email is required")
  .max(120)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address");

/**
 * Password policy matches what the sign-up form enforces, so the client
 * never promises something the server then rejects.
 */
export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/\d/, "Password must contain at least one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: emailSchema,
  password: passwordSchema,
  // A visitor may sign up as a business owner. "admin" is deliberately not
  // accepted here - admins are created by the createAdmin script or
  // promoted by another admin.
  role: z.enum(["customer", "owner"]).optional().default("customer"),
  phone: z.string().trim().max(20).optional(),
  city: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required").max(128),
});

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    city: z.string().trim().max(100).nullable().optional(),
    avatarUrl: z.string().trim().max(500).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update" });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: passwordSchema,
});

export const becomeOwnerSchema = z.object({
  phone: z.string().trim().min(6, "A contact phone number is required").max(20),
});
