import {
  formatNotificationTime,
  getNotificationPresentation,
} from "../notificationPresentation";

describe("notification presentation", () => {
  it("uses a vouch icon for new specialty endorsements", () => {
    expect(getNotificationPresentation("business_vouch_received")).toEqual({
      category: "vouch",
      icon: "thumb-up-outline",
    });
  });
  it("maps every current backend family to a stable semantic icon", () => {
    expect(
      getNotificationPresentation("business_name_change_approved"),
    ).toEqual({
      category: "business",
      icon: "storefront-outline",
    });
    expect(
      getNotificationPresentation("business_location_change_rejected"),
    ).toEqual({ category: "business", icon: "storefront-outline" });
    expect(getNotificationPresentation("review_report_approved")).toEqual({
      category: "review-moderation",
      icon: "message-text-outline",
    });
    expect(getNotificationPresentation("review_rejected")).toEqual({
      category: "review-moderation",
      icon: "message-text-outline",
    });
    expect(getNotificationPresentation("review_dispute_dismissed")).toEqual({
      category: "review-dispute",
      icon: "shield-check-outline",
    });
  });

  it("uses a bell fallback for future or unknown backend types", () => {
    expect(getNotificationPresentation("future_event")).toEqual({
      category: "general",
      icon: "bell-outline",
    });
  });

  it("formats concise relative timestamps and tolerates invalid input", () => {
    const now = new Date("2026-10-14T12:00:00.000Z");

    expect(formatNotificationTime("2026-10-14T11:59:45.000Z", now)).toBe(
      "Just now",
    );
    expect(formatNotificationTime("2026-10-14T11:55:00.000Z", now)).toBe(
      "5 min ago",
    );
    expect(formatNotificationTime("2026-10-14T10:00:00.000Z", now)).toBe(
      "2 hours ago",
    );
    expect(formatNotificationTime("2026-10-13T12:00:00.000Z", now)).toBe(
      "Yesterday",
    );
    expect(formatNotificationTime("2026-10-11T12:00:00.000Z", now)).toBe(
      "3 days ago",
    );
    expect(formatNotificationTime("not-a-date", now)).toBe("");
    expect(formatNotificationTime(null, now)).toBe("");
  });
});
