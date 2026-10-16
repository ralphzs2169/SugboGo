import { resolveAuthenticatedHomeRoute } from "@/features/app-mode/utils/resolveAppModeRoute";

describe("resolveAuthenticatedHomeRoute", () => {
  it("routes an Explorer account to Explorer even when stale Merchant mode exists", () => {
    expect(
      resolveAuthenticatedHomeRoute({ role: "explorer" }, "merchant"),
    ).toBe("/(explorer)/(tabs)/explore");
  });

  it("preserves Merchant navigation for an eligible active account", () => {
    expect(
      resolveAuthenticatedHomeRoute({ role: "merchant" }, "merchant"),
    ).toBe("/(merchant)/(tabs)/dashboard");
  });
});
