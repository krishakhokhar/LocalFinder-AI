import { z } from "zod";
import { latSchema, lngSchema, placeIdSchema } from "./searchSchemas.js";

export const addFavoriteSchema = z.object({
  placeId: placeIdSchema,
  name: z.string().trim().min(1, "name is required").max(200),
  category: z.string().trim().max(40).optional(),
  lat: latSchema,
  lng: lngSchema,
  address: z.string().trim().max(300).nullish(),
  phone: z.string().trim().max(40).nullish(),
  opening_hours: z.string().trim().max(300).nullish(),
});

export const removeByPlaceIdSchema = z.object({
  placeId: placeIdSchema,
});
