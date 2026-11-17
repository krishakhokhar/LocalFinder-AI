import { ZodError } from "zod";
import { ApiError } from "../utils/apiResponse.js";

/**
 * Request validation.
 *
 * Every write endpoint runs its body through a schema here, so controllers
 * can assume well-formed, correctly typed input and never have to re-check.
 * The parsed (coerced, stripped) value replaces the raw one, which also
 * means unknown keys never reach Mongoose - a cheap defence against mass
 * assignment.
 *
 * Express 5 makes `req.query` a getter, so the validated query is exposed
 * as `req.validatedQuery` rather than written back over it.
 */
function formatIssues(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

function run(schema, value, label) {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      const issues = formatIssues(error);
      throw ApiError.badRequest(issues[0]?.message || `Invalid ${label}`, {
        code: "VALIDATION_ERROR",
        errors: issues,
      });
    }
    throw error;
  }
}

export function validateBody(schema) {
  return (req, res, next) => {
    try {
      req.body = run(schema, req.body ?? {}, "request body");
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    try {
      req.validatedQuery = run(schema, req.query ?? {}, "query parameters");
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    try {
      req.validatedParams = run(schema, req.params ?? {}, "path parameters");
      next();
    } catch (error) {
      next(error);
    }
  };
}
