import React from "react";
import { render } from "@testing-library/react-native";

import ConfirmLocationSheet from "../ConfirmLocationSheet";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

describe("ConfirmLocationSheet service-area feedback", () => {
  it("does not mislabel a failed lookup as outside the service area", async () => {
    const screen = await render(
      <ConfirmLocationSheet
        address="Address unavailable"
        isResolvingAddress={false}
        isConfirming={false}
        isWithinServiceArea={false}
        serviceAreaFeedback="unavailable"
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/couldn't verify this location's service area/),
    ).toBeTruthy();
    expect(
      screen.queryByText(/outside SugboGo's current business service area/),
    ).toBeNull();
    expect(
      screen.getByLabelText("Confirm business location").props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it("keeps the outside-area message for an authoritative outside result", async () => {
    const screen = await render(
      <ConfirmLocationSheet
        address="Address unavailable"
        isResolvingAddress={false}
        isConfirming={false}
        isWithinServiceArea={false}
        serviceAreaFeedback="outside"
        onConfirm={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/outside SugboGo's current business service area/),
    ).toBeTruthy();
    expect(
      screen.queryByText(/couldn't verify this location's service area/),
    ).toBeNull();
  });
});
