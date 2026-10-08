import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { useLocationChangeReviewStore } from "@/features/merchant/stores/locationChangeReviewStore";
import LocationChangeReviewLandmarksRoute from "../review-landmarks";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));
jest.mock("@/features/merchant/screens/ReviewLandmarksScreen", () => ({
  __esModule: true,
  default: ({
    title,
    selectedLandmarks,
    onClose,
  }: {
    title: string;
    selectedLandmarks: { name: string }[];
    onClose: () => void;
  }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <Pressable onPress={onClose} accessibilityLabel="Close location review">
        <Text>{title}</Text>
        <Text>{selectedLandmarks[0]?.name}</Text>
      </Pressable>
    );
  },
}));

describe("Merchant location and landmark review", () => {
  it("shows the selected snapshot and returns to the request", async () => {
    useLocationChangeReviewStore.getState().setPreview(
      "Requested location",
      {
        latitude: 10.31,
        longitude: 123.88,
        address: "Osmeña Boulevard",
        city: "Cebu City",
        province: "Cebu",
        postal_code: "6000",
      },
      [
        {
          id: null,
          name: "Nearby landmark",
          address: "Cebu City",
          latitude: 10.32,
          longitude: 123.89,
          source: "google",
          place_id: "place-1",
        },
      ],
    );

    const screen = await render(<LocationChangeReviewLandmarksRoute />);
    expect(screen.getByText("Requested location")).toBeTruthy();
    expect(screen.getByText("Nearby landmark")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Close location review"));
    expect(router.back).toHaveBeenCalled();
    await screen.unmount();
    expect(useLocationChangeReviewStore.getState().businessLocation).toBeNull();
  });
});
