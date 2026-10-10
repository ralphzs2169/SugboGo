import React from "react";
import { Animated, StyleSheet } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import MerchantProfileStickyHeader from "../MerchantProfileStickyHeader";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 32, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

jest.mock("expo-image", () => {
  const { View } = jest.requireActual("react-native");

  return {
    Image: (props: Record<string, unknown>) => <View {...props} />,
  };
});

describe("MerchantProfileStickyHeader", () => {
  it("sits below the status bar and shows the business cover thumbnail", async () => {
    const onManageBusiness = jest.fn();
    const screen = await render(
      <MerchantProfileStickyHeader
        businessName="Sugbo Bistro"
        classification="Restaurant · Culinary"
        coverPhotoUrl="https://example.com/cover.jpg"
        visible
        opacity={new Animated.Value(1)}
        translateY={new Animated.Value(0)}
        onManageBusiness={onManageBusiness}
      />,
    );

    const header = screen.getByTestId("merchant-profile-sticky-header");
    expect(StyleSheet.flatten(header.props.style).top).toBe(32);
    expect(StyleSheet.flatten(header.props.style).elevation).toBeUndefined();

    const cover = screen.getByLabelText("Sugbo Bistro cover photo");
    expect(cover.props.source).toEqual({
      uri: "https://example.com/cover.jpg",
    });
    expect(cover.props.style).toMatchObject({ width: 40, height: 40 });

    await fireEvent.press(screen.getByLabelText("Manage business"));
    expect(onManageBusiness).toHaveBeenCalledTimes(1);
  });
});
