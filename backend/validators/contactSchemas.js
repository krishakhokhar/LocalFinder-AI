import { z } from "zod";
import { emailSchema } from "./authSchemas.js";

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: emailSchema,
  subject: z.string().trim().max(140).optional(),
  message: z
    .string()
    .trim()
    .min(5, "Message must be at least 5 characters")
    .max(2000, "Message must be at most 2000 characters"),
});
