import test from "node:test";
import assert from "node:assert/strict";
import { parseOpeningHours, isOpenNow, describeWeek } from "../utils/openingHours.js";

// Wednesday 2026-11-18, 10:30 IST (05:00 UTC)
const WED_MORNING = new Date(Date.UTC(2026, 10, 18, 5, 0));
const IST = 330;

test("24/7 is always open", () => {
  assert.equal(isOpenNow("24/7", IST, WED_MORNING), true);
});

test("weekday ranges are honoured", () => {
  assert.equal(isOpenNow("Mo-Fr 09:00-18:00", IST, WED_MORNING), true);
  assert.equal(isOpenNow("Mo-Fr 19:00-22:00", IST, WED_MORNING), false);
});

test("day lists are honoured", () => {
  assert.equal(isOpenNow("Mo,We,Fr 10:00-19:00", IST, WED_MORNING), true);
  assert.equal(isOpenNow("Mo,Tu,Fr 10:00-19:00", IST, WED_MORNING), false);
});

test("split intervals are honoured", () => {
  assert.equal(isOpenNow("Mo-Sa 09:00-13:00,16:00-20:00", IST, WED_MORNING), true);
  const afternoon = new Date(Date.UTC(2026, 10, 18, 9, 0)); // 14:30 IST
  assert.equal(isOpenNow("Mo-Sa 09:00-13:00,16:00-20:00", IST, afternoon), false);
});

test("explicit closed days are honoured", () => {
  const sunday = new Date(Date.UTC(2026, 10, 22, 5, 0));
  assert.equal(isOpenNow("Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off", IST, sunday), false);
});

test("times without a day selector apply every day", () => {
  assert.equal(isOpenNow("09:00-21:00", IST, WED_MORNING), true);
});

test("intervals crossing midnight resolve against the previous day", () => {
  const oneAm = new Date(Date.UTC(2026, 10, 18, 19, 30)); // 01:00 IST Thursday
  assert.equal(isOpenNow("Mo-Su 18:00-02:00", IST, oneAm), true);
  const noon = new Date(Date.UTC(2026, 10, 18, 6, 30)); // 12:00 IST
  assert.equal(isOpenNow("Mo-Su 18:00-02:00", IST, noon), false);
});

test("unsupported syntax reports unknown rather than guessing", () => {
  for (const value of ["sunrise-sunset", "Mo-Fr 09:00-18:00; PH off", "garbage", "", null]) {
    assert.equal(parseOpeningHours(value), null, `expected ${JSON.stringify(value)} to be unparseable`);
    assert.equal(isOpenNow(value, IST, WED_MORNING), null);
  }
});

test("describeWeek returns seven days or null", () => {
  const week = describeWeek("Mo-Fr 09:00-18:00; Sa 10:00-14:00; Su off");
  assert.equal(week.length, 7);
  assert.equal(week[0].text, "Closed");
  assert.equal(week[1].text, "09:00 - 18:00");
  assert.equal(week[6].text, "10:00 - 14:00");
  assert.equal(describeWeek("sunrise-sunset"), null);
});
