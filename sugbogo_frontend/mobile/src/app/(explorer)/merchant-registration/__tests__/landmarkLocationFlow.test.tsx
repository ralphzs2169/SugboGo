import React, { type PropsWithChildren } from "react";
import {
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import LocationPickerScreen from "@/features/merchant/screens/LocationPickerScreen";
import LandmarkPickerScreen from "@/features/merchant/screens/LandmarkPickerScreen";
import { useMerchantRegistrationStore } from "@/features/merchant/stores/merchantRegistrationStore";
import { searchNearbyLandmarksService } from "@/shared/api/googlePlaces.service";
import type { BusinessLocation } from "@/shared/types/BusinessLocation.types";
import BusinessLandmarkPickerPage from "../landmarks-picker";
import BusinessLocationPickerPage from "../location-picker";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));

jest.mock("react-native-toast-message", () => ({
  show: jest.fn(),
}));

jest.mock("react-hook-form", () => ({
  useFormContext: jest.fn(() => ({})),
}));

jest.mock("@/shared/api/googlePlaces.service", () => ({
  searchNearbyLandmarksService: jest.fn(),
}));

jest.mock("@/features/merchant/screens/LocationPickerScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@/features/merchant/screens/LandmarkPickerScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  });
}

function createWrapper(client: QueryClient) {
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

const businessLocation: BusinessLocation = {
  latitude: 10.3157,
  longitude: 123.8854,
  formattedAddress: "Cebu City, Cebu",
  province: "Cebu",
  city: "Cebu City",
  barangay: "Lahug",
  streetAddress: "Gorordo Avenue",
  isWithinServiceArea: true,
};

describe("merchant registration landmark location flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useMerchantRegistrationStore.getState().reset();
  });

  it("copies fetched suggestions into editable state when location is confirmed", async () => {
    (searchNearbyLandmarksService as jest.Mock).mockResolvedValue({
      success: true,
      message: "Nearby landmarks loaded.",
      data: {
        landmarks: [
          {
            id: "backend-id",
            name: "Cebu Monument",
            address: "Cebu City",
            latitude: 10.3158,
            longitude: 123.8855,
            source: "google",
            placeId: "place-1",
          },
        ],
      },
    });

    const client = createQueryClient();
    const wrapper = createWrapper(client);
    const screen = await render(<BusinessLocationPickerPage />, {
      wrapper,
    });
    const locationPicker = LocationPickerScreen as jest.Mock;
    const onConfirm = locationPicker.mock.calls[0][0].onConfirm;

    await act(async () => {
      onConfirm(businessLocation, false);
    });

    await waitFor(() =>
      expect(
        useMerchantRegistrationStore.getState().selectedLocation,
      ).toEqual(businessLocation),
    );

    expect(searchNearbyLandmarksService).toHaveBeenCalledWith(
      businessLocation.latitude,
      businessLocation.longitude,
    );
    expect(
      useMerchantRegistrationStore.getState().selectedLandmarks,
    ).toEqual([
      expect.objectContaining({
        id: "place-1",
        name: "Cebu Monument",
        source: "google",
      }),
    ]);
    expect(
      useMerchantRegistrationStore.getState().nearbyLandmarksLoadFailed,
    ).toBe(false);
    expect(Toast.show).toHaveBeenCalledWith({
      type: "success",
      text1: "Location confirmed successfully.",
    });
    expect(router.back).toHaveBeenCalledTimes(1);

    screen.unmount();
    client.clear();
  });

  it("opens the custom picker without refetching or replacing selections", async () => {
    const customLandmark = {
      id: "custom-1",
      name: "My Custom Landmark",
      address: "Near the shop",
      latitude: 10.3159,
      longitude: 123.8856,
      source: "custom" as const,
    };

    useMerchantRegistrationStore.setState({
      selectedLocation: businessLocation,
      selectedLandmarks: [customLandmark],
    });

    const screen = await render(<BusinessLandmarkPickerPage />);
    const landmarkPicker = LandmarkPickerScreen as jest.Mock;

    expect(searchNearbyLandmarksService).not.toHaveBeenCalled();
    expect(landmarkPicker).toHaveBeenCalledWith(
      expect.objectContaining({
        businessLocation,
        selectedLandmarks: [customLandmark],
      }),
      undefined,
    );
    expect(
      useMerchantRegistrationStore.getState().selectedLandmarks,
    ).toEqual([customLandmark]);

    screen.unmount();
  });
});
