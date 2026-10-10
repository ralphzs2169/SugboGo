import React from "react";
import { cleanup, render } from "@testing-library/react-native";

import LocationChangeHistoryScreen from "../LocationChangeHistoryScreen";

const mockProfile = jest.fn();
const mockHistory = jest.fn();

jest.mock("expo-router", () => ({
  router: { push: jest.fn(), back: jest.fn() },
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("../../../components/registration/location/LocationPickerMap", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockLocationMap() {
    return <Text>Location map preview</Text>;
  };
});
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequests: () => mockHistory(),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));

describe("LocationChangeHistoryScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    mockProfile.mockReturnValue({
      business: {
        status: "active",
        location: {
          latitude: 10.31,
          longitude: 123.88,
          address: "Osmeña Boulevard",
          city: "Cebu City",
          province: "Cebu",
        },
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockHistory.mockReturnValue({
      requests: [],
      totalRequests: 5,
      pendingRequest: null,
      isLoading: false,
      isRefetching: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: jest.fn(),
      error: null,
      refetch: jest.fn(),
    });
  });

  it("shows the backend total beside the heading and retains the map", async () => {
    const screen = await render(<LocationChangeHistoryScreen />);
    expect(screen.getByText("Location map preview")).toBeTruthy();
    expect(screen.getByTestId("history-count")).toHaveTextContent("(5)");
  });

  it("hides zero and unavailable totals", async () => {
    mockHistory.mockReturnValue({ ...mockHistory(), totalRequests: 0 });
    const screen = await render(<LocationChangeHistoryScreen />);
    expect(screen.queryByTestId("history-count")).toBeNull();
    mockHistory.mockReturnValue({ ...mockHistory(), totalRequests: undefined });
    screen.rerender(<LocationChangeHistoryScreen />);
    expect(screen.queryByTestId("history-count")).toBeNull();
  });
});
