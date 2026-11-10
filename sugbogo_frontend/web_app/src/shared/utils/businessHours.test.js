import assert from "node:assert/strict";
import test from "node:test";

import * as web from "./businessHours.js";
// Test-only comparison: Node strips these types without loading Expo's tsconfig.
import * as mobile from "../../../../mobile/src/features/explore/utils/businessHours.utils.ts";

const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const hours = (day = "monday", overrides = {}) => ({
  day, is_open: true, is_24_hours: false,
  open_time: "08:00:00", close_time: "20:30:00", ...overrides,
});

test("preserves the four existing web exports", () => {
  assert.deepEqual(Object.keys(web).sort(), [
    "formatTime", "getBusinessDay", "getBusinessHoursSummary", "getNextBusinessHoursUpdate",
  ]);
});

test("uses inclusive opening and exclusive closing in Manila time", () => {
  for (const [instant, expected] of [
    ["2026-10-11T23:59:59.999Z", "closed"],
    ["2026-10-12T00:00:00.000Z", "open"],
    ["2026-10-12T12:29:59.999Z", "open"],
    ["2026-10-12T12:30:00.000Z", "closed"],
  ]) {
    assert.equal(web.getBusinessHoursSummary([hours()], new Date(instant)).status, expected);
  }
});

test("matches the original mobile rules across schedules and exact boundaries", () => {
  const schedules = [
    [],
    [hours()],
    days.map((day) => hours(day)),
    days.map((day) => hours(day, { is_open: false })),
    days.map((day) => hours(day, { is_24_hours: true, open_time: null, close_time: null })),
    days.map((day) => hours(day, { open_time: "22:00", close_time: "02:15" })),
    [hours("sunday", { open_time: "22:00", close_time: "02:15" })],
    [hours("sunday", { open_time: "22:00", close_time: "10:00" }), hours()],
    [hours("monday", { open_time: "08:00", close_time: "08:00" })],
    [hours("monday", { open_time: "08:00:30.500", close_time: "08:01:15.250" })],
    [hours("monday", { open_time: null })],
    [hours("monday", { close_time: "invalid" })],
    [hours("monday", { is_open: false, is_24_hours: true }), hours("tuesday", { close_time: null })],
  ];
  const start = Date.parse("2026-10-11T16:00:00Z"); // Monday midnight in Manila.
  const times = [0, 2 * 3600 + 15 * 60, 8 * 3600, 8 * 3600 + 30.5,
    8 * 3600 + 75.25, 10 * 3600, 20 * 3600 + 30 * 60, 22 * 3600, 24 * 3600];
  for (let day = 0; day < 7; day += 1) {
    for (const seconds of times) {
      for (const offset of [-1, 0, 1]) {
        const now = new Date(start + day * 86_400_000 + seconds * 1000 + offset);
        assert.equal(web.getBusinessDay(now), mobile.getBusinessDay(now));
        for (const schedule of schedules) {
          assert.deepEqual(web.getBusinessHoursSummary(schedule, now),
            mobile.getBusinessHoursSummary(schedule, now), now.toISOString());
          assert.equal(web.getNextBusinessHoursUpdate(schedule, now),
            mobile.getNextBusinessHoursUpdate(schedule, now), now.toISOString());
        }
      }
    }
  }
  for (const time of ["00:00", "08:15", "12:00:00", "20:30:00", "23:59:59"]) {
    assert.equal(web.formatTime(time), mobile.formatTime(time));
  }
});
