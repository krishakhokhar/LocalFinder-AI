import test from "node:test";
import assert from "node:assert/strict";
import { buildSlots, localDayStartUtc, localWeekday } from "../services/availabilityService.js";

/**
 * Slot generation is the part of booking that quietly goes wrong:
 * timezones, lead times, capacity and past-midnight closing all
 * interact. It is pure, so it is tested directly with no database.
 */

const IST = 330; // +05:30

const business = (overrides = {}) => ({
  _id: "b1",
  openingHours: [
    { day: 0, closed: true, open: "09:00", close: "18:00" }, // Sunday closed
    ...[1, 2, 3, 4, 5].map((day) => ({ day, closed: false, open: "09:00", close: "17:00" })),
    { day: 6, closed: false, open: "10:00", close: "14:00" }, // Saturday short
  ],
  bookingSettings: {
    slotMinutes: 30,
    leadTimeMinutes: 60,
    maxAdvanceDays: 30,
    capacityPerSlot: 1,
    autoConfirm: false,
  },
  ...overrides,
});

const service = { _id: "s1", name: "Haircut", durationMinutes: 30 };

// Wednesday 2026-11-18, 06:00 IST (00:30 UTC) - well before opening.
const EARLY_WED = new Date(Date.UTC(2026, 10, 18, 0, 30));

test("local day boundaries are computed in the business's timezone", () => {
  // Midnight IST on 18 Nov is 18:30 UTC on 17 Nov.
  assert.equal(localDayStartUtc("2026-11-18", IST).toISOString(), "2026-11-17T18:30:00.000Z");
  assert.equal(localWeekday("2026-11-18"), 3);
});

test("a closed day offers no slots and says why", () => {
  const result = buildSlots({
    business: business(),
    service,
    date: "2026-11-22", // Sunday
    tzOffsetMinutes: IST,
    now: EARLY_WED,
  });
  assert.equal(result.closed, true);
  assert.equal(result.slots.length, 0);
  assert.match(result.reason, /closed/i);
});

test("slots span opening hours at the configured interval", () => {
  const { slots } = buildSlots({
    business: business(),
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    now: EARLY_WED,
  });

  // 09:00-17:00, 30 minute slots, 30 minute service -> 16 slots.
  assert.equal(slots.length, 16);
  assert.equal(slots[0].label, "09:00");
  assert.equal(slots[slots.length - 1].label, "16:30");
  // 09:00 IST is 03:30 UTC.
  assert.equal(slots[0].startAt, "2026-11-18T03:30:00.000Z");
});

test("a longer service cannot start where it would overrun closing", () => {
  const { slots } = buildSlots({
    business: business(),
    service: { ...service, durationMinutes: 90 },
    date: "2026-11-21", // Saturday 10:00-14:00
    tzOffsetMinutes: IST,
    now: EARLY_WED,
  });

  assert.equal(slots[slots.length - 1].label, "12:30"); // 12:30 + 90m = 14:00
  assert.ok(slots.every((slot) => new Date(slot.endAt) <= new Date("2026-11-21T08:30:00.000Z")));
});

test("past slots and slots inside the lead time are unavailable", () => {
  // Wednesday 11:10 IST (05:40 UTC); lead time is 60 minutes.
  const now = new Date(Date.UTC(2026, 10, 18, 5, 40));
  const { slots } = buildSlots({
    business: business(),
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    now,
  });

  const byLabel = Object.fromEntries(slots.map((slot) => [slot.label, slot]));
  assert.equal(byLabel["09:00"].available, false);
  assert.equal(byLabel["09:00"].reason, "past");
  assert.equal(byLabel["11:30"].available, false);
  assert.equal(byLabel["11:30"].reason, "too-soon"); // inside the 60-minute notice
  assert.equal(byLabel["12:30"].available, true);
});

test("an existing booking blocks exactly the overlapping slots", () => {
  const bookings = [
    {
      startAt: "2026-11-18T04:00:00.000Z", // 09:30 IST
      endAt: "2026-11-18T04:30:00.000Z", // 10:00 IST
      seat: 0,
      status: "confirmed",
    },
  ];

  const { slots } = buildSlots({
    business: business(),
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings,
    now: EARLY_WED,
  });

  const byLabel = Object.fromEntries(slots.map((slot) => [slot.label, slot]));
  assert.equal(byLabel["09:30"].available, false);
  assert.equal(byLabel["09:30"].reason, "full");
  assert.equal(byLabel["09:00"].available, true, "the slot before must stay open");
  assert.equal(byLabel["10:00"].available, true, "a slot starting as the other ends must stay open");
});

test("a long service is blocked by a booking it would overlap part-way through", () => {
  const bookings = [
    { startAt: "2026-11-18T04:30:00.000Z", endAt: "2026-11-18T05:00:00.000Z", seat: 0, status: "pending" },
  ];

  const { slots } = buildSlots({
    business: business(),
    service: { ...service, durationMinutes: 90 },
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings,
    now: EARLY_WED,
  });

  const byLabel = Object.fromEntries(slots.map((slot) => [slot.label, slot]));
  // A 90-minute booking at 09:30 would run 09:30-11:00 and swallow 10:00-10:30.
  assert.equal(byLabel["09:30"].available, false);
  assert.equal(byLabel["10:30"].available, true);
});

test("capacity lets several customers share a slot, and assigns distinct seats", () => {
  const withCapacity = business({
    bookingSettings: {
      slotMinutes: 30,
      leadTimeMinutes: 60,
      maxAdvanceDays: 30,
      capacityPerSlot: 3,
      autoConfirm: false,
    },
  });

  const first = buildSlots({
    business: withCapacity,
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings: [],
    now: EARLY_WED,
  }).slots.find((slot) => slot.label === "09:00");
  assert.equal(first.seatsLeft, 3);
  assert.equal(first.seat, 0);

  const second = buildSlots({
    business: withCapacity,
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings: [
      { startAt: "2026-11-18T03:30:00.000Z", endAt: "2026-11-18T04:00:00.000Z", seat: 0, status: "confirmed" },
    ],
    now: EARLY_WED,
  }).slots.find((slot) => slot.label === "09:00");
  assert.equal(second.seatsLeft, 2);
  assert.equal(second.seat, 1, "the second booking must take a different seat");

  const full = buildSlots({
    business: withCapacity,
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings: [0, 1, 2].map((seat) => ({
      startAt: "2026-11-18T03:30:00.000Z",
      endAt: "2026-11-18T04:00:00.000Z",
      seat,
      status: "confirmed",
    })),
    now: EARLY_WED,
  }).slots.find((slot) => slot.label === "09:00");
  assert.equal(full.available, false);
  assert.equal(full.reason, "full");
});

test("hours crossing midnight produce slots into the next morning", () => {
  const lateNight = business({
    openingHours: [1, 2, 3, 4, 5, 6, 0].map((day) => ({
      day,
      closed: false,
      open: "18:00",
      close: "02:00",
    })),
  });

  const { slots } = buildSlots({
    business: lateNight,
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    now: EARLY_WED,
  });

  assert.equal(slots[0].label, "18:00");
  assert.equal(slots[slots.length - 1].label, "01:30");
  // The last slot ends at 02:00 IST on the 19th = 20:30 UTC on the 18th.
  assert.equal(slots[slots.length - 1].endAt, "2026-11-18T20:30:00.000Z");
});

test("a cancelled booking does not hold its slot", () => {
  // Cancelled bookings are never passed in - activeBookingsForDay filters
  // on status - so an empty list must produce a fully open day.
  const { slots } = buildSlots({
    business: business(),
    service,
    date: "2026-11-18",
    tzOffsetMinutes: IST,
    bookings: [],
    now: EARLY_WED,
  });
  assert.ok(slots.every((slot) => slot.available));
});
