import express from "express";
import {
  overview,
  listBusinesses,
  decideBusiness,
  listUsers,
  updateUser,
  listReviews,
  moderateReview,
  listReports,
  resolveReport,
  listContacts,
  updateContact,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  analytics,
} from "../controllers/adminController.js";
import { protect, requireRole } from "../middleware/authMiddleware.js";
import { validateBody, validateParams, validateQuery } from "../middleware/validate.js";
import {
  idParamSchema,
  listBusinessesSchema,
  decisionSchema,
  listUsersSchema,
  updateUserSchema,
  listReviewsSchema,
  moderateReviewSchema,
  listReportsSchema,
  resolveReportSchema,
  listContactsSchema,
  updateContactSchema,
  categorySchema,
  updateCategorySchema,
  analyticsSchema,
} from "../validators/adminSchemas.js";

const router = express.Router();

/**
 * Every admin route sits behind this one gate.
 *
 * Authorisation is enforced here on the server, for the whole subtree.
 * The React app also hides admin navigation from non-admins, but that is
 * a convenience: anyone can edit client-side state, so it is not and
 * cannot be the control that matters.
 */
router.use(protect, requireRole("admin"));

router.get("/overview", overview);
router.get("/analytics", validateQuery(analyticsSchema), analytics);

router.get("/businesses", validateQuery(listBusinessesSchema), listBusinesses);
router.post(
  "/businesses/:id/decision",
  validateParams(idParamSchema),
  validateBody(decisionSchema),
  decideBusiness
);

router.get("/users", validateQuery(listUsersSchema), listUsers);
router.patch("/users/:id", validateParams(idParamSchema), validateBody(updateUserSchema), updateUser);

router.get("/reviews", validateQuery(listReviewsSchema), listReviews);
router.patch(
  "/reviews/:id",
  validateParams(idParamSchema),
  validateBody(moderateReviewSchema),
  moderateReview
);

router.get("/reports", validateQuery(listReportsSchema), listReports);
router.patch(
  "/reports/:id",
  validateParams(idParamSchema),
  validateBody(resolveReportSchema),
  resolveReport
);

router.get("/contacts", validateQuery(listContactsSchema), listContacts);
router.patch(
  "/contacts/:id",
  validateParams(idParamSchema),
  validateBody(updateContactSchema),
  updateContact
);

router.get("/categories", listCategories);
router.post("/categories", validateBody(categorySchema), createCategory);
router.patch(
  "/categories/:id",
  validateParams(idParamSchema),
  validateBody(updateCategorySchema),
  updateCategory
);
router.delete("/categories/:id", validateParams(idParamSchema), deleteCategory);

export default router;
