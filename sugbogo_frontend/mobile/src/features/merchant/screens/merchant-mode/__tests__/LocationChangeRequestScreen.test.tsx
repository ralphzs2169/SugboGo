import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { useLocationChangeDraftStore } from "../../../stores/locationChangeDraftStore";
import LocationChangeRequestScreen from "../LocationChangeRequestScreen";

const mockProfile = jest.fn();
const mockRequests = jest.fn();
const mockSubmit = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequests: () => mockRequests(),
  useSubmitMerchantLocationChange: () => ({
    mutateAsync: mockSubmit,
    isPending: false,
  }),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock(
  "../../../components/registration/landmark/SelectedLandmarksSection",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock(
  "../../../components/registration/location/LocationPickerMap",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock(
  "../../../components/location-change/LocationChangeComparison",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);

const business = {
  id: 7,
  status: "active",
  location: {
    latitude: 10.31,
    longitude: 123.88,
    address: "Current flat address",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    landmarks: [],
  },
};

describe("Location change request form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReset();
    mockRequests.mockReset();
    mockSubmit.mockReset();
    useLocationChangeDraftStore.getState().reset();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockRequests.mockReturnValue({
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockSubmit.mockResolvedValue({ id: 22 });
  });

  it("blocks unchanged submission and sends both proposed fields after review", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByText("Review Request")).toBeTruthy(),
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Review Request"));
    });
    await waitFor(() =>
      expect(
        screen.getByText("Choose a different location or landmark set."),
      ).toBeTruthy(),
    );
    expect(mockSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "New flat address",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Review Request"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Submit Request"));
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      proposed_location: {
        latitude: 10.31,
        longitude: 123.88,
        address: "New flat address",
        city: "Cebu City",
        province: "Cebu",
        postal_code: "6000",
      },
      proposed_landmarks: [],
    });
    expect(business.location.address).toBe("Current flat address");
    expect(router.replace).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/location/22",
    );
    screen.unmount();
  });

  it("shows a persistent retry state when request history fails", async () => {
    const refetch = jest.fn();
    mockRequests.mockReturnValue({
      pendingRequest: null,
      hasData: false,
      isLoading: false,
      error: new Error("Network unavailable"),
      refetch,
    });
    const screen = await render(<LocationChangeRequestScreen />);

    expect(screen.getByText("Unable to load location request")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
    screen.unmount();
  });
});
