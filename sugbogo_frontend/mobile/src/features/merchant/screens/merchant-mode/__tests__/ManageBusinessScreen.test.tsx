import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react-native";

import ManageBusinessScreen from "../ManageBusinessScreen";

const mockPush = jest.fn();
const mockProfile = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

const business = {
  status: "active",
  business_name: "Sugbo Bistro",
  category: { name: "Cafe" },
  cluster: { name: "Culinary" },
  location: { address: "Osmeña Boulevard" },
  photos: [],
};

describe("ManageBusinessScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      refetch: jest.fn(),
    });
  });

  it("opens each reviewed-change history directly", async () => {
    const screen = await render(<ManageBusinessScreen />);

    await fireEvent.press(screen.getByLabelText("View business name requests"));
    await fireEvent.press(
      screen.getByLabelText("View classification requests"),
    );
    await fireEvent.press(
      screen.getByLabelText("View location & landmarks requests"),
    );

    expect(mockPush.mock.calls.map(([route]) => route)).toEqual([
      "/(merchant)/business-update-requests",
      "/(merchant)/business-update-requests/classification",
      "/(merchant)/business-update-requests/location",
    ]);
    expect(screen.queryByText("Updates")).toBeNull();
    expect(screen.queryByText("Request history")).toBeNull();
  });

  it("preserves direct editing routes", async () => {
    const screen = await render(<ManageBusinessScreen />);
    await fireEvent.press(screen.getByText("Business information"));
    await fireEvent.press(screen.getByText("Operating hours"));
    await fireEvent.press(screen.getByText("Photos"));
    expect(mockPush.mock.calls.map(([route]) => route)).toEqual([
      "/(merchant)/business-information",
      "/(merchant)/operating-hours",
      "/(merchant)/business-photos",
    ]);
  });

  it("allows suspended merchants to view history while direct editing stays disabled", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      refetch: jest.fn(),
    });
    const screen = await render(<ManageBusinessScreen />);
    expect(screen.getByText(/Changes are unavailable/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("View business name requests"));
    await fireEvent.press(
      screen.getByLabelText("View classification requests"),
    );
    await fireEvent.press(
      screen.getByLabelText("View location & landmarks requests"),
    );
    expect(mockPush).toHaveBeenCalledTimes(3);
    await fireEvent.press(screen.getByText("Business information"));
    expect(mockPush).toHaveBeenCalledTimes(3);
  });
});
