import { resolveNotificationDestination } from "../notificationDestination";

describe("notification destinations", () => {
  it.each([
    ["review_dispute", "/(merchant)/review-disputes/[disputeId]", "disputeId"],
    [
      "business_name_change",
      "/(merchant)/business-update-requests/[requestId]",
      "requestId",
    ],
    [
      "business_classification_change",
      "/(merchant)/business-update-requests/classification/[requestId]",
      "requestId",
    ],
    [
      "business_location_change",
      "/(merchant)/business-update-requests/location/[requestId]",
      "requestId",
    ],
  ])("maps %s to its confirmed route", (targetType, pathname, paramName) => {
    const result = resolveNotificationDestination({
      target_type: targetType,
      target_id: 42,
    });

    expect(result.kind).toBe("destination");

    if (result.kind === "destination") {
      expect(result.destination.href).toEqual({
        pathname,
        params: { [paramName]: "42" },
      });
      expect(result.destination.requiredMode).toBe("merchant");
    }
  });

  it("does not construct routes for unknown target types", () => {
    expect(
      resolveNotificationDestination({
        target_type: "merchant/../../admin",
        target_id: 5,
      }),
    ).toEqual({ kind: "informational" });
  });

  it.each([null, 0, -1, 1.5, Number.NaN])(
    "treats a supported target with invalid id %s as unavailable",
    (targetId) => {
      expect(
        resolveNotificationDestination({
          target_type: "review_dispute",
          target_id: targetId,
        }),
      ).toEqual({ kind: "unavailable" });
    },
  );
});
