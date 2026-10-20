import { recentActivityItem } from "../../__tests__/merchantRecentActivity.fixtures";
import {
  formatRecentActivityTime,
  recentActivityReviewId,
} from "../merchantRecentActivity.utils";

it("labels save days using Manila midnight even while UTC remains on the previous day", () => {
  const save = recentActivityItem({ type: "save", target: null });
  expect(formatRecentActivityTime(save, new Date("2026-10-20T16:30:00Z"))).toBe(
    "Yesterday",
  );
  expect(formatRecentActivityTime(save, new Date("2026-10-20T05:00:00Z"))).toBe(
    "Today",
  );
});

it("uses relative time for public updates and falls back to a day for invalid timestamps", () => {
  const now = new Date("2026-10-20T05:00:00Z");
  expect(formatRecentActivityTime(recentActivityItem(), now)).toBe(
    "30 min ago",
  );
  expect(
    formatRecentActivityTime(
      recentActivityItem({ occurred_at: "invalid" }),
      now,
    ),
  ).toBe("Today");
});

it("rejects invalid or informational destinations", () => {
  expect(recentActivityReviewId(recentActivityItem())).toBe(123);
  expect(
    recentActivityReviewId(recentActivityItem({ type: "save" })),
  ).toBeNull();
  expect(
    recentActivityReviewId(recentActivityItem({ type: "vouch" })),
  ).toBeNull();
  expect(
    recentActivityReviewId(recentActivityItem({ target: null })),
  ).toBeNull();
  expect(
    recentActivityReviewId(
      recentActivityItem({ target: { type: "business_review", id: 0 } }),
    ),
  ).toBeNull();
});
