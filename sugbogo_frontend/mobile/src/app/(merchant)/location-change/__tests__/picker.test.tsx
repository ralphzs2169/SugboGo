import React from "react";
import { act, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useLocationChangeDraftStore } from "@/features/merchant/stores/locationChangeDraftStore";
import LocationChangePickerRoute from "../picker";

const mockSearchNearbyLandmarks = jest.fn();
const mockPickerScreen = jest.fn((_props: unknown) => null);
const mockConfirmModal = jest.fn((_props: unknown) => null);
const mockProfile = jest.fn();
const mockRequests = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), replace: jest.fn() },
}));
jest.mock(
  "@/features/merchant/hooks/business-profile/useMerchantBusinessProfile",
  () => ({ __esModule: true, default: () => mockProfile() }),
);
jest.mock(
  "@/features/merchant/hooks/location-change/useMerchantLocationChanges",
  () => ({ useMerchantLocationChangeRequests: () => mockRequests() }),
);
jest.mock(
  "@/features/merchant/hooks/location-selection/useNearbyLandmarks",
  () => ({
    __esModule: true,
    default: () => ({ searchNearbyLandmarks: mockSearchNearbyLandmarks }),
  }),
);
jest.mock("@/features/merchant/screens/LocationPickerScreen", () => ({
  __esModule: true,
  default: (props: unknown) => mockPickerScreen(props),
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockConfirmModal(props),
}));

const original = {
  latitude: 10.31,
  longitude: 123.88,
  address: "Current flat address",
  city: "Cebu City",
  province: "Cebu",
  postal_code: "6000",
};
const nearby = {
  id: "new-place",
  name: "New landmark",
  address: "Near new pin",
  latitude: 10.34,
  longitude: 123.9,
  source: "google" as const,
  placeId: "new-place",
};

describe("Location change map picker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useLocationChangeDraftStore.getState().reset();
    useLocationChangeDraftStore.setState({
      businessId: 7,
      location: original,
      landmarks: [{ ...nearby, id: "old-place", name: "Old landmark" }],
    });
    mockProfile.mockReturnValue({
      business: { id: 7, status: "active" },
      isLoading: false,
    });
    mockRequests.mockReturnValue({ pendingRequest: null, isLoading: false });
    mockSearchNearbyLandmarks.mockResolvedValue({
      success: true,
      landmarks: [nearby],
    });
  });

  it("clears the old proposed set before looking up the new pin", async () => {
    const screen = await render(<LocationChangePickerRoute />);
    const selected = {
      latitude: 10.33,
      longitude: 123.89,
      formattedAddress: "New flat address",
      city: "Cebu City",
      province: "Cebu",
      barangay: "",
      streetAddress: "",
      isWithinServiceArea: true,
    };
    mockSearchNearbyLandmarks.mockImplementation(async () => {
      expect(useLocationChangeDraftStore.getState().landmarks).toEqual([]);
      return { success: true, landmarks: [nearby] };
    });

    await act(async () => {
      (mockPickerScreen as jest.Mock).mock.lastCall[0].onConfirm(selected);
    });
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    await waitFor(() =>
      expect(mockSearchNearbyLandmarks).toHaveBeenCalledWith(10.33, 123.89),
    );
    expect(useLocationChangeDraftStore.getState().landmarks).toEqual([nearby]);
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "New flat address",
    );
    expect(router.back).toHaveBeenCalled();
    screen.unmount();
  });

  it("keeps selected landmarks for the same pin and still updates display address", async () => {
    const screen = await render(<LocationChangePickerRoute />);
    await act(async () => {
      (mockPickerScreen as jest.Mock).mock.lastCall[0].onConfirm({
        latitude: original.latitude,
        longitude: original.longitude,
        formattedAddress: "Corrected flat address",
        city: original.city,
        province: original.province,
        barangay: "",
        streetAddress: "",
        isWithinServiceArea: true,
      });
    });

    expect(mockSearchNearbyLandmarks).not.toHaveBeenCalled();
    expect(useLocationChangeDraftStore.getState().landmarks).toHaveLength(1);
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "Corrected flat address",
    );
    screen.unmount();
  });
});
