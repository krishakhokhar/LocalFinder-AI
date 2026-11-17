import test from "node:test";
import assert from "node:assert/strict";

// createApp() never touches the database, so the routing table, validation
// and error handling can all be exercised without a Mongo connection.
process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-test-secret-test-secret";
process.env.NODE_ENV = "test";

const { createApp } = await import("../app.js");

const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

test.after(() => server.close());

test("health endpoint reports the database state", async () => {
  // No database is connected in this test, so health must say so rather
  // than claiming the service is fine.
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.status, "degraded");
  assert.equal(body.database, "disconnected");
});

test("endpoints that need the database fail fast with 503, not a slow 500", async () => {
  const started = Date.now();
  const res = await fetch(`${base}/api/businesses`);
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.code, "DATABASE_UNAVAILABLE");
  assert.ok(Date.now() - started < 5000, "must fail fast rather than hanging on the default 10s buffer");
});

test("search still works without a database", async () => {
  const res = await fetch(`${base}/api/services/categories`);
  assert.equal(res.status, 200);
});

test("unknown routes return a JSON 404", async () => {
  const res = await fetch(`${base}/api/does-not-exist`);
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.success, false);
  assert.equal(body.code, "NOT_FOUND");
});

test("categories are served without a database", async () => {
  const res = await fetch(`${base}/api/services/categories`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.categories));
  assert.ok(body.categories.some((category) => category.key === "salon"));
});

test("nearby search rejects a missing location", async () => {
  const res = await fetch(`${base}/api/services/nearby`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "VALIDATION_ERROR");
  assert.ok(body.errors.some((error) => error.field === "lat"));
});

test("nearby search rejects an out-of-range latitude", async () => {
  const res = await fetch(`${base}/api/services/nearby?lat=991&lng=72`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /lat must be between/);
});

test("registration rejects a weak password before reaching the database", async () => {
  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test User", email: "test@example.com", password: "abcdef" }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /number/i);
});

test("protected routes reject anonymous callers", async () => {
  const res = await fetch(`${base}/api/favorites`);
  assert.equal(res.status, 401);
  const body = await res.json();
  assert.equal(body.success, false);
});

test("mongo operator syntax is stripped from request bodies", async () => {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: { $gt: "" }, password: "whatever" }),
  });
  // The operator object is removed, so validation sees a missing email.
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "VALIDATION_ERROR");
});

test("disallowed CORS origins are refused", async () => {
  const res = await fetch(`${base}/health`, { headers: { Origin: "https://evil.example.com" } });
  assert.equal(res.status, 403);
});

test("allowed CORS origins pass through", async () => {
  // Checked on a route that does not depend on the database, so this
  // stays a CORS assertion rather than accidentally testing health.
  const res = await fetch(`${base}/api/services/categories`, {
    headers: { Origin: "http://localhost:5173" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("access-control-allow-origin"), "http://localhost:5173");
});

test("admin routes reject anonymous callers", async () => {
  for (const path of [
    "/api/admin/overview",
    "/api/admin/users",
    "/api/admin/businesses",
    "/api/admin/reviews",
    "/api/admin/reports",
    "/api/admin/categories",
    "/api/admin/analytics",
  ]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 401, `${path} must require authentication`);
  }
});

test("owner routes reject anonymous callers", async () => {
  for (const path of ["/api/owner/overview", "/api/businesses/mine"]) {
    const res = await fetch(`${base}${path}`);
    assert.equal(res.status, 401, `${path} must require authentication`);
  }
});

test("a forged bearer token is rejected", async () => {
  const res = await fetch(`${base}/api/admin/overview`, {
    headers: { Authorization: "Bearer not.a.real.token" },
  });
  assert.equal(res.status, 401);
});

test("booking status changes require authentication", async () => {
  const res = await fetch(`${base}/api/bookings/507f1f77bcf86cd799439011/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "confirmed" }),
  });
  assert.equal(res.status, 401);
});

test("public availability validates its input", async () => {
  const res = await fetch(`${base}/api/bookings/availability?businessId=nope&serviceId=nope&date=today`);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.code, "VALIDATION_ERROR");
});

test("the AI endpoint rejects an empty message without calling the model", async () => {
  const res = await fetch(`${base}/api/ai/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "   " }),
  });
  assert.equal(res.status, 400);
});

test("the AI endpoint caps message length", async () => {
  const res = await fetch(`${base}/api/ai/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "a".repeat(5000) }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.match(body.message, /500 characters/);
});

test("uploads require authentication", async () => {
  const res = await fetch(`${base}/api/uploads/images`, { method: "POST" });
  assert.equal(res.status, 401);
});
