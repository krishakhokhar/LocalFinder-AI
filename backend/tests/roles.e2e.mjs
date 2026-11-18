/**
 * Role-wise end-to-end test suite.
 *
 *   npm run test:roles
 *
 * Unlike tests/*.test.js, this one needs a real database: it exercises
 * authentication, role gates, ownership checks, the booking lifecycle and
 * moderation, all of which are about stored state.
 *
 * It never touches your real data. On startup it derives a throwaway
 * database name from MONGO_URI, refuses to run if that name would collide
 * with the application's own database, boots the real Express app against
 * it on an ephemeral port, and drops the whole database again at the end -
 * including when a check fails.
 *
 * Nothing here is asserted as passing unless the server actually returned
 * it; every failure prints what was expected and what arrived.
 */
import "../config/loadEnv.js"; // must stay the first import - see the file

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { ensureSrvResolution } from "../config/dns.js";

const QA_DB = "localfinder_qa_e2e";

/* ------------------------------------------------------------ database -- */

/** Rewrites MONGO_URI so it points at a throwaway database on the same cluster. */
function qaUri(uri) {
  if (!uri) throw new Error("MONGO_URI is not set - copy backend/.env.example to backend/.env");
  const queryAt = uri.indexOf("?");
  const base = queryAt === -1 ? uri : uri.slice(0, queryAt);
  const query = queryAt === -1 ? "" : uri.slice(queryAt);

  // Strip whatever database name the URI already carries, if any.
  const schemeEnd = uri.indexOf("://") + 3;
  const hostStart = base.indexOf("/", schemeEnd);
  const hostPart = hostStart === -1 ? base : base.slice(0, hostStart);
  const existingDb = hostStart === -1 ? "" : base.slice(hostStart + 1);

  // The guard that makes this safe to run against a production cluster.
  if (existingDb === QA_DB) {
    throw new Error(`Refusing to run: MONGO_URI already points at ${QA_DB}`);
  }
  return `${hostPart}/${QA_DB}${query}`;
}

const uri = qaUri(process.env.MONGO_URI);

// The rate limiter reads this on every request, so setting it here still
// takes effect. NODE_ENV cannot be changed from here - config/env.js has
// already snapshotted it - but anything other than "production" behaves
// the same for these checks.
process.env.ENABLE_RATE_LIMIT = "false";

await ensureSrvResolution(uri);
await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

if (mongoose.connection.db.databaseName !== QA_DB) {
  throw new Error(`Refusing to run against database "${mongoose.connection.db.databaseName}"`);
}

/* ---------------------------------------------------------------- app -- */

const { createApp } = await import("../app.js");
const app = createApp();
const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* ------------------------------------------------------------ fixtures -- */

const STAMP = Date.now().toString(36);
const mail = (who) => `qa-${who}-${STAMP}@localfinder.test`;
const PASSWORD = "QaPass123";
const LAT = 21.21549; // Yogi Chowk, Surat
const LNG = 72.88705;
const TZ = 330; // IST, in minutes

// The admin is seeded directly, for the same reason the application has a
// createAdmin script: there is deliberately no public path to the role.
const { default: User } = await import("../models/User.js");
const ADMIN_EMAIL = `qa-admin-${STAMP}@localfinder.test`;
const ADMIN_PASSWORD = "QaAdmin123";
await User.create({
  name: "QA Admin",
  email: ADMIN_EMAIL,
  password: await bcrypt.hash(ADMIN_PASSWORD, 10),
  role: "admin",
});

/* ---------------------------------------------------------- assertions -- */

const results = [];
let phase = "";

function setPhase(name) {
  phase = name;
  console.log(`\n=== ${name} ===`);
}

function check(id, name, ok, detail = "") {
  results.push({ phase, id, name, ok: !!ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(5)} ${name}${detail ? `  -> ${detail}` : ""}`);
  return !!ok;
}

function expectStatus(id, name, r, expected) {
  const list = Array.isArray(expected) ? expected : [expected];
  const ok = list.includes(r.status);
  return check(
    id,
    name,
    ok,
    ok ? `${r.status}` : `got ${r.status} (expected ${list.join("/")}) ${JSON.stringify(r.body).slice(0, 180)}`
  );
}

async function call(method, path, { token, body, query } = {}) {
  const url = new URL(BASE + path);
  if (query)
    for (const [k, v] of Object.entries(query))
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));

  const res = await fetch(url, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const ct = res.headers.get("content-type") || "";
  const payload = ct.includes("json")
    ? await res.json().catch(() => null)
    : { text: await res.text().catch(() => "") };
  return { status: res.status, body: payload ?? {} };
}

const get = (p, o) => call("GET", p, o);
const post = (p, body, o) => call("POST", p, { ...o, body });
const patch = (p, body, o) => call("PATCH", p, { ...o, body });
const put = (p, body, o) => call("PUT", p, { ...o, body });
const del = (p, o) => call("DELETE", p, o);

const state = {};

/* ------------------------------------------------------------------ A --
 * Anonymous: what the API must refuse before anyone signs in.
 * --------------------------------------------------------------------- */
async function phaseA() {
  setPhase("A - anonymous / public surface");

  expectStatus("A1", "GET /businesses is public", await get("/api/businesses"), 200);
  expectStatus("A2", "GET /auth/me without token", await get("/api/auth/me"), 401);
  expectStatus("A3", "GET /admin/overview without token", await get("/api/admin/overview"), 401);
  expectStatus("A4", "GET /businesses/mine without token", await get("/api/businesses/mine"), 401);
  expectStatus("A5", "GET /bookings/mine without token", await get("/api/bookings/mine"), 401);
  expectStatus("A6", "POST /businesses without token", await post("/api/businesses", { name: "x" }), 401);
  expectStatus("A7", "GET /auth/me with a forged token", await get("/api/auth/me", { token: "not.a.real.jwt" }), 401);

  // The one that matters most: self-service admin must be impossible.
  const r = await post("/api/auth/register", {
    name: "Escalation Attempt",
    email: mail("escalate"),
    password: PASSWORD,
    role: "admin",
  });
  expectStatus("A8", "register with role=admin is rejected", r, 400);
}

/* ------------------------------------------------------------------ B --
 * Customer: the default role.
 * --------------------------------------------------------------------- */
async function phaseB() {
  setPhase("B - customer role");

  const email = mail("customer");
  state.customerEmail = email;
  const reg = await post("/api/auth/register", { name: "QA Customer", email, password: PASSWORD });
  expectStatus("B1", "register a customer", reg, 201);
  state.customer = reg.body.token;
  state.customerId = reg.body.user?._id || reg.body.user?.id;
  check("B2", "default role is customer", reg.body.user?.role === "customer", `role=${reg.body.user?.role}`);
  check("B3", "a token is returned on register", typeof state.customer === "string" && state.customer.length > 20);

  const me = await get("/api/auth/me", { token: state.customer });
  expectStatus("B4", "GET /auth/me as customer", me, 200);
  check("B5", "password is never returned", !JSON.stringify(me.body).includes(PASSWORD));

  const upd = await patch("/api/auth/me", { name: "QA Customer Renamed" }, { token: state.customer });
  expectStatus("B6", "PATCH /auth/me updates profile", upd, 200);
  check("B7", "the new name persisted", upd.body.user?.name === "QA Customer Renamed", upd.body.user?.name);

  expectStatus(
    "B8",
    "duplicate email is refused",
    await post("/api/auth/register", { name: "Dup", email, password: PASSWORD }),
    [400, 409]
  );
  expectStatus(
    "B9",
    "change-password with a wrong current password",
    await post("/api/auth/change-password", { currentPassword: "WrongPass9", newPassword: "NewPass123" }, { token: state.customer }),
    [400, 401]
  );
  expectStatus(
    "B10",
    "change-password with the right current password",
    await post("/api/auth/change-password", { currentPassword: PASSWORD, newPassword: "NewPass123" }, { token: state.customer }),
    200
  );
  expectStatus("B11", "the old password no longer works", await post("/api/auth/login", { email, password: PASSWORD }), 401);

  const relogin = await post("/api/auth/login", { email, password: "NewPass123" });
  expectStatus("B12", "the new password works", relogin, 200);
  if (relogin.body.token) state.customer = relogin.body.token;

  // Role boundaries, from below.
  expectStatus("B13", "customer -> /admin/overview", await get("/api/admin/overview", { token: state.customer }), 403);
  expectStatus("B14", "customer -> /owner/overview", await get("/api/owner/overview", { token: state.customer }), 403);
  expectStatus("B15", "customer -> /businesses/mine", await get("/api/businesses/mine", { token: state.customer }), 403);
  expectStatus(
    "B16",
    "customer -> create a business",
    await post("/api/businesses", { name: "Sneaky", category: "salon", address: { city: "Surat" }, lat: LAT, lng: LNG }, { token: state.customer }),
    403
  );
  expectStatus("B17", "customer -> /admin/users", await get("/api/admin/users", { token: state.customer }), 403);
}

/* ------------------------------------------------------------------ C --
 * Owner: can create and manage only their own businesses.
 * --------------------------------------------------------------------- */
async function phaseC() {
  setPhase("C - owner role");

  const o1 = await post("/api/auth/register", { name: "QA Owner One", email: mail("owner1"), password: PASSWORD, role: "owner" });
  expectStatus("C1", "register an owner", o1, 201);
  state.owner1 = o1.body.token;
  state.owner1Id = o1.body.user?._id || o1.body.user?.id;
  check("C2", "role is owner", o1.body.user?.role === "owner", `role=${o1.body.user?.role}`);

  const o2 = await post("/api/auth/register", { name: "QA Owner Two", email: mail("owner2"), password: PASSWORD, role: "owner" });
  state.owner2 = o2.body.token;

  const create = await post(
    "/api/businesses",
    {
      name: `QA Glow Salon ${STAMP}`,
      category: "salon",
      description: "Fixture created by the role-wise test suite.",
      phone: "9999900001",
      address: { line1: "Yogi Chowk", area: "Varachha", city: "Surat", state: "Gujarat", pincode: "395010" },
      lat: LAT,
      lng: LNG,
    },
    { token: state.owner1 }
  );
  expectStatus("C3", "owner creates a business", create, 201);
  state.bizId = create.body.business?._id || create.body.business?.id;
  check("C4", "a new business starts as draft", create.body.business?.status === "draft", `status=${create.body.business?.status}`);
  check("C5", "a new business is not verified", create.body.business?.verified === false);

  const mine = await get("/api/businesses/mine", { token: state.owner1 });
  expectStatus("C6", "owner sees their own businesses", mine, 200);
  const list = mine.body.businesses || mine.body.items || [];
  check("C7", "the created business appears in /mine", list.some((b) => String(b._id) === String(state.bizId)), `${list.length} returned`);

  const mine2 = await get("/api/businesses/mine", { token: state.owner2 });
  const list2 = mine2.body.businesses || mine2.body.items || [];
  check("C8", "a second owner sees none of owner 1's businesses", !list2.some((b) => String(b._id) === String(state.bizId)), `${list2.length} returned`);

  const pub1 = await get("/api/businesses");
  check("C9", "a draft is NOT in the public list", !(pub1.body.businesses || []).some((b) => String(b._id) === String(state.bizId)));

  const submit = await post(`/api/businesses/${state.bizId}/submit`, {}, { token: state.owner1 });
  expectStatus("C10", "owner submits for review", submit, 200);
  check("C11", "status becomes pending", submit.body.business?.status === "pending", `status=${submit.body.business?.status}`);

  const pub2 = await get("/api/businesses");
  check("C12", "a pending business is still NOT public", !(pub2.body.businesses || []).some((b) => String(b._id) === String(state.bizId)));

  // Cross-owner isolation - the part a role check alone would not catch.
  expectStatus("C13", "owner 2 cannot edit owner 1's business", await patch(`/api/businesses/${state.bizId}`, { name: "Hijacked" }, { token: state.owner2 }), [403, 404]);
  expectStatus("C14", "owner 2 cannot delete owner 1's business", await del(`/api/businesses/${state.bizId}`, { token: state.owner2 }), [403, 404]);
  expectStatus("C15", "owner 2 cannot read owner 1's analytics", await get(`/api/owner/businesses/${state.bizId}/analytics`, { token: state.owner2 }), [403, 404]);
  expectStatus("C16", "owner 2 cannot add a service to owner 1's business", await post(`/api/businesses/${state.bizId}/services`, { name: "Injected", durationMinutes: 30 }, { token: state.owner2 }), [403, 404]);

  expectStatus("C17", "owner -> /owner/overview", await get("/api/owner/overview", { token: state.owner1 }), 200);
  expectStatus("C18", "owner -> /admin/overview", await get("/api/admin/overview", { token: state.owner1 }), 403);
  expectStatus("C19", "owner -> /admin/users", await get("/api/admin/users", { token: state.owner1 }), 403);
  expectStatus("C20", "owner edits their own business", await patch(`/api/businesses/${state.bizId}`, { description: "Updated by the owner." }, { token: state.owner1 }), 200);
}

/* ------------------------------------------------------------------ D --
 * Admin: created only by provisioning, never by registration.
 * --------------------------------------------------------------------- */
async function phaseD() {
  setPhase("D - admin role");

  const login = await post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  expectStatus("D1", "the provisioned admin can log in", login, 200);
  state.admin = login.body.token;
  check("D2", "role is admin", login.body.user?.role === "admin", `role=${login.body.user?.role}`);
  if (!state.admin) return;

  expectStatus("D3", "admin -> /admin/overview", await get("/api/admin/overview", { token: state.admin }), 200);
  expectStatus("D4", "admin -> /admin/analytics", await get("/api/admin/analytics", { token: state.admin, query: { days: 30 } }), 200);

  const pending = await get("/api/admin/businesses", { token: state.admin, query: { status: "pending" } });
  expectStatus("D5", "admin lists pending businesses", pending, 200);
  const pendList = pending.body.businesses || pending.body.items || [];
  check("D6", "the submitted business is in the queue", pendList.some((b) => String(b._id) === String(state.bizId)), `${pendList.length} pending`);

  expectStatus("D7", "admin approves the business", await post(`/api/admin/businesses/${state.bizId}/decision`, { decision: "approve" }, { token: state.admin }), 200);

  const pub = await get("/api/businesses");
  check("D8", "an approved business becomes public", (pub.body.businesses || []).some((b) => String(b._id) === String(state.bizId)), `${(pub.body.businesses || []).length} public`);

  const users = await get("/api/admin/users", { token: state.admin, query: { q: `qa-customer-${STAMP}` } });
  expectStatus("D9", "admin lists users", users, 200);
  check("D10", "the test customer is findable by search", (users.body.users || users.body.items || []).some((u) => String(u._id) === String(state.customerId)));

  // Deactivation must take effect on the existing token, not at expiry.
  expectStatus("D11", "admin deactivates a user", await patch(`/api/admin/users/${state.customerId}`, { isActive: false }, { token: state.admin }), 200);
  expectStatus("D12", "a deactivated user's existing token stops working", await get("/api/auth/me", { token: state.customer }), 403);
  expectStatus("D13", "a deactivated user cannot log in", await post("/api/auth/login", { email: state.customerEmail, password: "NewPass123" }), [401, 403]);
  expectStatus("D14", "admin reactivates the user", await patch(`/api/admin/users/${state.customerId}`, { isActive: true }, { token: state.admin }), 200);
  expectStatus("D15", "the same token works again", await get("/api/auth/me", { token: state.customer }), 200);

  expectStatus("D16", "admin may use owner routes", await get("/api/owner/overview", { token: state.admin }), 200);
  expectStatus("D17", "admin -> /admin/reports", await get("/api/admin/reports", { token: state.admin }), 200);
  expectStatus("D18", "admin -> /admin/contacts", await get("/api/admin/contacts", { token: state.admin }), 200);
}

/* ------------------------------------------------------------------ E --
 * Booking flow across all three roles.
 * --------------------------------------------------------------------- */
async function phaseE() {
  setPhase("E - booking flow");

  const svc = await post(
    `/api/businesses/${state.bizId}/services`,
    { name: "Haircut", durationMinutes: 30, price: 250, currency: "INR" },
    { token: state.owner1 }
  );
  expectStatus("E1", "owner adds a service", svc, [200, 201]);
  state.serviceId = svc.body.service?._id;
  check("E2", "the service has an id", Boolean(state.serviceId), state.serviceId || JSON.stringify(svc.body).slice(0, 160));
  check("E2b", "a published price is stored as given, not zeroed", svc.body.service?.price === 250, `price=${svc.body.service?.price}`);

  const hours = Array.from({ length: 7 }, (_, day) => ({ day, closed: false, open: "09:00", close: "21:00" }));
  expectStatus("E3", "owner sets opening hours", await put(`/api/businesses/${state.bizId}/hours`, { openingHours: hours }, { token: state.owner1 }), 200);
  expectStatus(
    "E4",
    "owner enables bookings",
    await patch(`/api/businesses/${state.bizId}/booking-settings`, { acceptsBookings: true, slotMinutes: 30, leadTimeMinutes: 0, capacityPerSlot: 1, autoConfirm: false }, { token: state.owner1 }),
    200
  );

  // Two days out, so lead time can never make the day legitimately empty.
  const date = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  const avail = await get("/api/bookings/availability", { query: { businessId: state.bizId, serviceId: state.serviceId, date, tz: TZ } });
  expectStatus("E5", "availability is readable without signing in", avail, 200);
  const slots = (avail.body.slots || []).filter((s) => s.available !== false);
  check("E6", "the day has bookable slots", slots.length > 0, `${slots.length} free slot(s) on ${date}`);
  const slot = slots[0];
  state.startAt = slot?.startAt || slot?.start || slot;

  if (!state.startAt) {
    check("E7", "booking flow continues", false, "no slot to book - later booking checks skipped");
    return;
  }

  const booking = await post(
    "/api/bookings",
    { businessId: state.bizId, serviceId: state.serviceId, startAt: state.startAt, note: "QA booking", tz: TZ },
    { token: state.customer }
  );
  expectStatus("E7", "customer books a slot", booking, 201);
  state.bookingId = booking.body.booking?._id;
  check("E8", "a booking starts pending (autoConfirm off)", booking.body.booking?.status === "pending", `status=${booking.body.booking?.status}`);

  expectStatus(
    "E9",
    "the same slot cannot be double-booked (capacity 1)",
    await post("/api/bookings", { businessId: state.bizId, serviceId: state.serviceId, startAt: state.startAt, tz: TZ }, { token: state.customer }),
    [400, 409]
  );

  const mineB = await get("/api/bookings/mine", { token: state.customer, query: { scope: "all" } });
  expectStatus("E10", "customer sees their booking", mineB, 200);
  check("E11", "the booking is listed", (mineB.body.bookings || []).some((b) => String(b._id) === String(state.bookingId)));

  expectStatus("E12", "a customer cannot read the business booking sheet", await get(`/api/bookings/business/${state.bizId}`, { token: state.customer }), 403);
  expectStatus("E13", "another owner cannot read this business's bookings", await get(`/api/bookings/business/${state.bizId}`, { token: state.owner2, query: { scope: "all" } }), [403, 404]);

  const sheet = await get(`/api/bookings/business/${state.bizId}`, { token: state.owner1, query: { scope: "all" } });
  expectStatus("E14", "the owner reads their booking sheet", sheet, 200);
  check("E15", "the booking is on the sheet", (sheet.body.bookings || []).some((b) => String(b._id) === String(state.bookingId)));

  expectStatus("E16", "a customer cannot confirm their own booking", await patch(`/api/bookings/${state.bookingId}/status`, { status: "confirmed" }, { token: state.customer }), 403);

  const conf = await patch(`/api/bookings/${state.bookingId}/status`, { status: "confirmed" }, { token: state.owner1 });
  expectStatus("E17", "the owner confirms the booking", conf, 200);
  check("E18", "status is confirmed", conf.body.booking?.status === "confirmed", `status=${conf.body.booking?.status}`);

  const laterSlot = slots[1];
  if (laterSlot) {
    expectStatus("E19", "customer reschedules", await post(`/api/bookings/${state.bookingId}/reschedule`, { startAt: laterSlot.startAt || laterSlot.start, tz: TZ }, { token: state.customer }), 200);
  } else {
    check("E19", "customer reschedules", false, "no second slot available to move to");
  }

  const cancel = await post(`/api/bookings/${state.bookingId}/cancel`, { reason: "QA cleanup" }, { token: state.customer });
  expectStatus("E20", "customer cancels", cancel, 200);
  check("E21", "status is cancelled", cancel.body.booking?.status === "cancelled", `status=${cancel.body.booking?.status}`);
}

/* ------------------------------------------------------------------ F --
 * Reviews and moderation.
 * --------------------------------------------------------------------- */
async function phaseF() {
  setPhase("F - reviews and moderation");

  const placeId = `local:${state.bizId}`;
  const rev = await post(
    "/api/reviews",
    { placeId, placeName: `QA Glow Salon ${STAMP}`, rating: 5, comment: "Test review from the QA suite.", lat: LAT, lng: LNG },
    { token: state.customer }
  );
  expectStatus("F1", "customer writes a review", rev, 201);
  state.reviewId = rev.body.review?._id;

  expectStatus(
    "F2",
    "the same person cannot review the same place twice",
    await post("/api/reviews", { placeId, placeName: "QA Glow Salon", rating: 1, comment: "Second one." }, { token: state.customer }),
    [400, 409]
  );

  const listed = await get(`/api/reviews/place/${encodeURIComponent(placeId)}`);
  expectStatus("F3", "reviews for a place are public", listed, 200);
  check("F4", "the review is listed", (listed.body.reviews || []).some((r) => String(r._id) === String(state.reviewId)), `${(listed.body.reviews || []).length} review(s)`);

  expectStatus("F5", "the author edits their review", await patch(`/api/reviews/${state.reviewId}`, { rating: 4 }, { token: state.customer }), 200);
  expectStatus("F6", "another user cannot edit someone else's review", await patch(`/api/reviews/${state.reviewId}`, { rating: 1 }, { token: state.owner2 }), [403, 404]);
  expectStatus("F7", "another user cannot delete someone else's review", await del(`/api/reviews/${state.reviewId}`, { token: state.owner2 }), [403, 404]);
  expectStatus("F8", "a review cannot be written anonymously", await post("/api/reviews", { placeId, placeName: "x", rating: 5 }), 401);
  expectStatus("F9", "another user reports the review", await post(`/api/reviews/${state.reviewId}/report`, { reason: "spam", details: "QA report" }, { token: state.owner2 }), [200, 201]);

  if (state.admin) {
    const modList = await get("/api/admin/reviews", { token: state.admin });
    expectStatus("F10", "admin lists reviews", modList, 200);
    check("F11", "the review is visible to moderation", (modList.body.reviews || modList.body.items || []).some((r) => String(r._id) === String(state.reviewId)));

    expectStatus("F12", "admin hides a review", await patch(`/api/admin/reviews/${state.reviewId}`, { status: "hidden", note: "QA" }, { token: state.admin }), 200);

    const afterHide = await get(`/api/reviews/place/${encodeURIComponent(placeId)}`);
    check("F13", "a hidden review disappears from the public list", !(afterHide.body.reviews || []).some((r) => String(r._id) === String(state.reviewId)));

    expectStatus("F14", "admin republishes it", await patch(`/api/admin/reviews/${state.reviewId}`, { status: "published" }, { token: state.admin }), 200);

    const reports = await get("/api/admin/reports", { token: state.admin });
    const rid = (reports.body.reports || reports.body.items || [])[0]?._id;
    check("F15", "the report reached the admin queue", Boolean(rid), rid ? `report ${rid}` : "no reports returned");
    if (rid) {
      expectStatus("F16", "admin resolves the report", await patch(`/api/admin/reports/${rid}`, { status: "resolved", resolution: "QA" }, { token: state.admin }), 200);
    }
  }

  expectStatus("F17", "the author deletes their own review", await del(`/api/reviews/${state.reviewId}`, { token: state.customer }), 200);
}

/* ------------------------------------------------------------------ G --
 * Privilege escalation by mass assignment.
 *
 * Role gates are only half of access control. The other half is refusing
 * to let a caller set a field they were never offered - a status, a role,
 * a verified flag smuggled into an otherwise ordinary update.
 * --------------------------------------------------------------------- */
async function phaseG() {
  setPhase("G - privilege escalation attempts");

  await patch("/api/auth/me", { name: "Still A Customer", role: "admin" }, { token: state.customer });
  const me = await get("/api/auth/me", { token: state.customer });
  check("G1", "role cannot be changed through PATCH /auth/me", me.body.user?.role === "customer", `role=${me.body.user?.role}`);

  await patch("/api/auth/me", { name: "Still Active", isActive: false }, { token: state.customer });
  expectStatus("G2", "isActive cannot be set through PATCH /auth/me", await get("/api/auth/me", { token: state.customer }), 200);

  const sneaky = await post(
    "/api/businesses",
    {
      name: `QA Self Approved ${STAMP}`,
      category: "salon",
      address: { city: "Surat" },
      lat: LAT,
      lng: LNG,
      status: "approved",
      verified: true,
      ratingAvg: 5,
      ratingCount: 999,
    },
    { token: state.owner1 }
  );
  expectStatus("G3", "owner creates a business with smuggled fields", sneaky, 201);
  const sneakyId = sneaky.body.business?._id;
  check("G4", "status is forced to draft", sneaky.body.business?.status === "draft", `status=${sneaky.body.business?.status}`);
  check("G5", "verified is forced to false", sneaky.body.business?.verified === false, `verified=${sneaky.body.business?.verified}`);
  check(
    "G6",
    "rating cannot be seeded by the owner",
    (sneaky.body.business?.ratingAvg ?? 0) === 0 && (sneaky.body.business?.ratingCount ?? 0) === 0,
    `avg=${sneaky.body.business?.ratingAvg} count=${sneaky.body.business?.ratingCount}`
  );

  await patch(`/api/businesses/${sneakyId}`, { status: "approved", verified: true }, { token: state.owner1 });
  const after = await get(`/api/businesses/${sneakyId}`, { token: state.owner1 });
  const b = after.body.business || {};
  check("G7", "status cannot be raised by the owner", b.status !== "approved", `status=${b.status}`);
  check("G8", "verified cannot be set by the owner", b.verified !== true, `verified=${b.verified}`);

  const pub = await get("/api/businesses");
  check("G9", "the smuggled business is not public", !(pub.body.businesses || []).some((x) => String(x._id) === String(sneakyId)));

  // Moderation bypass: can an author undo an admin's decision by editing?
  const placeId = `local:${state.bizId}`;
  const rev = await post(
    "/api/reviews",
    { placeId, placeName: `QA Glow Salon ${STAMP}`, rating: 5, comment: "Moderation bypass probe." },
    { token: state.customer }
  );
  const revId = rev.body.review?._id;
  if (revId && state.admin) {
    expectStatus("G10", "admin hides the review", await patch(`/api/admin/reviews/${revId}`, { status: "hidden" }, { token: state.admin }), 200);
    await patch(`/api/reviews/${revId}`, { rating: 4, status: "published" }, { token: state.customer });

    const hiddenList = await get("/api/admin/reviews", { token: state.admin, query: { status: "hidden" } });
    check("G11", "an author cannot republish a review the admin hid", (hiddenList.body.reviews || hiddenList.body.items || []).some((r) => String(r._id) === String(revId)));

    const publicList = await get(`/api/reviews/place/${encodeURIComponent(placeId)}`);
    check("G12", "it stays out of the public list after the author edits it", !(publicList.body.reviews || []).some((r) => String(r._id) === String(revId)));
  } else {
    check("G10", "moderation bypass probe", false, "could not create the probe review");
  }

  expectStatus("G13", "customer cannot promote themselves via /admin/users", await patch(`/api/admin/users/${state.customerId}`, { role: "admin" }, { token: state.customer }), 403);
  expectStatus("G14", "owner cannot promote themselves via /admin/users", await patch(`/api/admin/users/${state.owner1Id}`, { role: "admin" }, { token: state.owner1 }), 403);

  const finalMe = await get("/api/auth/me", { token: state.customer });
  check("G15", "after every attempt the customer is still a customer", finalMe.body.user?.role === "customer", `role=${finalMe.body.user?.role}`);
}

/* --------------------------------------------------------------------- */

async function teardown() {
  try {
    await mongoose.connection.db.dropDatabase();
    console.log(`\nCleaned up: dropped the throwaway database "${QA_DB}".`);
  } catch (error) {
    console.error(`\nWARNING: could not drop "${QA_DB}": ${error.message}`);
  }
  await mongoose.connection.close().catch(() => {});
  server.close();
}

console.log(`LocalFinder-AI role-wise test run`);
console.log(`  app      : ${BASE}`);
console.log(`  database : ${QA_DB} (throwaway, dropped on exit)`);
console.log(`  fixtures : ${STAMP}`);

for (const fn of [phaseA, phaseB, phaseC, phaseD, phaseE, phaseF, phaseG]) {
  try {
    await fn();
  } catch (error) {
    check("ERR", `${phase} threw`, false, error.message);
  }
}

const failed = results.filter((r) => !r.ok);
console.log("\n==================== SUMMARY ====================");
const byPhase = {};
for (const r of results) {
  byPhase[r.phase] ??= { pass: 0, fail: 0 };
  byPhase[r.phase][r.ok ? "pass" : "fail"] += 1;
}
for (const [name, c] of Object.entries(byPhase)) {
  console.log(`${c.fail === 0 ? "OK  " : "FAIL"}  ${name}: ${c.pass} passed, ${c.fail} failed`);
}
console.log(`\nTOTAL: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  ${f.id}  ${f.name}  -> ${f.detail}`);
}

await teardown();
process.exit(failed.length ? 1 : 0);
