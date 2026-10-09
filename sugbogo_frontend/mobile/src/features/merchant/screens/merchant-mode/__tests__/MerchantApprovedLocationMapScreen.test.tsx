import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import MerchantApprovedLocationMapScreen from "../MerchantApprovedLocationMapScreen";

const mockProfile = jest.fn();
const mockMap = jest.fn();

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("../../../components/registration/landmark/LanmarkMap", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockLandmarkMap(props: unknown) {
    mockMap(props);
    return <Text>Approved landmark map</Text>;
  };
});
jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
}));

describe("MerchantApprovedLocationMapScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes approved coordinates and landmarks to the shared map", async () => {
    mockProfile.mockReturnValue({
      business: {
        business_name: "Sugbo Bistro",
        location: {
          latitude: 10.3157,
          longitude: 123.8854,
          landmarks: [
            {
              id: 4,
              name: "Ayala Center",
              address: "Cebu Business Park",
              latitude: 10.318,
              longitude: 123.905,
              source: "google",
            },
          ],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantApprovedLocationMapScreen />);
    expect(screen.getByText("Approved landmark map")).toBeTruthy();
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({
        businessLocation: expect.objectContaining({ latitude: 10.3157 }),
        selectedLandmarks: [
          expect.objectContaining({ id: "4", name: "Ayala Center" }),
        ],
      }),
    );
    await fireEvent.press(screen.getByLabelText("Go back"));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("keeps the business pin when there are no landmarks", async () => {
    mockProfile.mockReturnValue({
      business: {
        business_name: "Sugbo Bistro",
        location: {
          latitude: 10.3157,
          longitude: 123.8854,
          landmarks: [],
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<MerchantApprovedLocationMapScreen />);
    expect(
      screen.getByText("Approved business location · 0 landmarks"),
    ).toBeTruthy();
    expect(mockMap).toHaveBeenCalledWith(
      expect.objectContaining({ selectedLandmarks: [] }),
    );
    expect(mockMap.mock.lastCall?.[0].onMapPress).toBeUndefined();
    expect(mockMap.mock.lastCall?.[0].onLandmarkPress).toBeUndefined();
  });
});
