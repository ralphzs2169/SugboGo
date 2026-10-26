import React from "react";
import { render } from "@testing-library/react-native";
import MerchantReviewManagement from "../MerchantReviewManagement";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../assets/icons/quick-replies.svg", () => () => null);
jest.mock("../../../assets/icons/review-disputes.svg", () => () => null);

describe("Merchant management count presentation", () => {
  it("labels unavailable counts without displaying a zero", async () => {
    const screen = await render(
      <MerchantReviewManagement disputesUnavailable templatesUnavailable />,
    );
    expect(screen.getAllByText("Count unavailable")).toHaveLength(2);
    expect(screen.queryByText("0 pending cases")).toBeNull();
    expect(screen.queryByText("0 saved responses")).toBeNull();
  });
  it("shows genuine zero counts", async () => {
    const screen = await render(
      <MerchantReviewManagement
        pendingDisputeCount={0}
        quickResponseCount={0}
      />,
    );
    expect(screen.getByText("0 pending cases")).toBeTruthy();
    expect(screen.getByText("0 saved responses")).toBeTruthy();
  });
});
