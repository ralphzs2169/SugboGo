import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ManageBusinessScreen from "../ManageBusinessScreen";

const mockPush = jest.fn();
const mockProfile = jest.fn();
const mockName = jest.fn();
const mockClassification = jest.fn();
const mockLocation = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequests: () => mockName(),
  }),
);
jest.mock(
  "../../../hooks/classification-change/useMerchantClassificationChanges",
  () => ({
    useMerchantClassificationChangeRequests: () => mockClassification(),
  }),
);
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequests: () => mockLocation(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.mockReturnValue({
    business: {
      status: "active",
      business_name: "Sugbo Bistro",
      category: { name: "Cafe" },
      cluster: { name: "Culinary" },
      location: { address: "Osmeña Boulevard" },
      photos: [],
    },
    isLoading: false,
    refetch: jest.fn(),
  });
  mockName.mockReturnValue({
    pendingRequest: null,
    isLoading: false,
    error: null,
  });
  mockClassification.mockReturnValue({
    pendingRequest: null,
    isLoading: false,
    error: null,
  });
  mockLocation.mockReturnValue({
    pendingRequest: null,
    isLoading: false,
    error: null,
  });
});

describe("ManageBusinessScreen", () => {
  it("opens existing direct-edit and reviewed-change routes", async () => {
    const screen = await render(<ManageBusinessScreen />);

    expect(screen.getByText("Business information")).toBeTruthy();
    expect(screen.getByText("Business name")).toBeTruthy();
    expect(screen.getByText("Classification")).toBeTruthy();
    expect(screen.getByText("Location & landmarks")).toBeTruthy();
    expect(screen.getByText("Operating hours")).toBeTruthy();
    expect(screen.getByText("Photos")).toBeTruthy();
    expect(screen.getByText("Change Requests")).toBeTruthy();

    await fireEvent.press(screen.getByText("Business information"));
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/business-information");

    await fireEvent.press(screen.getByText("Business name"));
    await fireEvent.press(screen.getByText("Request change ›"));
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/business-name-change");

    await fireEvent.press(screen.getByText("Change Requests"));
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/change-requests");
  });

  it("shows the active request instead of a new request action", async () => {
    mockName.mockReturnValue({
      pendingRequest: { id: 9 },
      isLoading: false,
      error: null,
    });
    const screen = await render(<ManageBusinessScreen />);

    await fireEvent.press(screen.getByText("Business name"));
    expect(screen.queryByText("Request change ›")).toBeNull();
    await fireEvent.press(screen.getByText("View pending request ›"));
    expect(mockPush).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/9",
    );
  });

  it("disables changes for a suspended business", async () => {
    mockProfile.mockReturnValue({
      business: {
        status: "suspended",
        business_name: "Sugbo Bistro",
        category: { name: "Cafe" },
        cluster: { name: "Culinary" },
        location: { address: "Osmeña Boulevard" },
        photos: [],
      },
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);

    await fireEvent.press(screen.getByText("Business name"));
    expect(screen.queryByText("Request change ›")).toBeNull();
    expect(screen.getByText(/Changes are unavailable/)).toBeTruthy();
  });
});
