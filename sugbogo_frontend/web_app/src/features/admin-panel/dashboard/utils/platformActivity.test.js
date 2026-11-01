import assert from "node:assert/strict";
import { test } from "node:test";
import { platformActivityDays } from "./platformActivity.js";
import { dashboardFixture } from "../tests/dashboardFixtures.js";

test("daily presentation preserves seven real chronological server buckets and zero observations", () => {
  const activity = dashboardFixture(
    "/admin/dashboard/platform-overview/",
  ).activity;
  assert.equal(platformActivityDays(activity), activity.daily);
  assert.equal(activity.daily[0].vouches_created, 0);
  for (const key of [
    "applications_submitted",
    "reviews_published",
    "vouches_created",
  ]) {
    assert.equal(
      activity.daily.reduce((sum, day) => sum + day[key], 0),
      activity[key],
    );
  }
});

test("missing, malformed or nonconsecutive observations stay unavailable instead of becoming zero", () => {
  const activity = dashboardFixture(
    "/admin/dashboard/platform-overview/",
  ).activity;
  for (const daily of [
    undefined,
    activity.daily.slice(1),
    [...activity.daily].reverse(),
    activity.daily.map((row, index) => (index === 2 ? null : row)),
    activity.daily.map((row, index) =>
      index === 2 ? { ...row, reviews_published: null } : row,
    ),
    activity.daily.map((row, index) =>
      index === 2 ? { ...row, date: "2026-02-30" } : row,
    ),
    activity.daily.map((row, index) =>
      index === 2 ? { ...row, vouches_created: -1 } : row,
    ),
  ]) {
    assert.equal(platformActivityDays({ ...activity, daily }), null);
  }
});
