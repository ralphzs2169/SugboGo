import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { LocationObject } from "expo-location";

import ExploreScreen from "../ExploreScreen";
import useOpenNowBusinesses from "../../hooks/useOpenNowBusinesses";

const mockPush = jest.fn();
const mockRefreshLocation = jest.fn();
const mockRefreshAtLocation = jest.fn(async () => undefined);
const mockQueryClient = {
  refetchQueries: jest.fn(async () => undefined),
  cancelQueries: jest.fn(async () => undefined),
};
const mockLocation = {
  coords: { latitude: 10.33, longitude: 123.9, accuracy: 15 },
} as LocationObject;
const nextLocation = {
  coords: { latitude: 10.328, longitude: 123.907, accuracy: 10 },
} as LocationObject;

jest.mock("../../api/exploreBusiness.service", () => ({}));

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
}));
jest.mock("@tanstack/react-query", () => ({
  useQueryClient: () => mockQueryClient,
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 0,
}));
jest.mock("@/shared/hooks/useUserLocation", () => () => ({
  location: mockLocation,
  status: "available",
  isRefreshingLocation: false,
  refreshLocation: mockRefreshLocation,
}));
jest.mock("../../hooks/useOpenNowBusinesses", () => ({
  __esModule: true,
  default: jest.fn(() => ({
    businesses: [],
    refreshAtLocation: mockRefreshAtLocation,
  })),
}));
jest.mock("../../hooks/useBusinessImpressions", () => () => ({
  onViewportLayout: jest.fn(),
  onVerticalScroll: jest.fn(),
}));
jest.mock("../../hooks/useMapPreviewBusinesses", () => ({
  __esModule: true,
  default: () => ({ businesses: [] }),
  MAP_PREVIEW_QUERY_KEY: ["map-preview"],
}));
jest.mock("../../hooks/useDiscoveryFeed", () => ({
  __esModule: true,
  default: () => ({ businesses: [] }),
  DISCOVERY_FEED_QUERY_KEY: ["discovery"],
}));
jest.mock("../../hooks/useExploreFilterOptions", () => () => ({
  options: { clusters: [] },
}));
jest.mock("../../components/ExploreTopBar", () => () => null);
jest.mock("../../components/hidden-gems/HiddenGemsSection", () => () => null);
jest.mock("../../components/interests/UserInterestsSection", () => () => null);
jest.mock(
  "../../components/new-businesses/NewBusinessesSection",
  () => () => null,
);
jest.mock(
  "../../components/explore-by-specialty/ExploreBySpecialtySection",
  () => () => null,
);
jest.mock(
  "../../components/discovery-shortcuts/DiscoveryShortcutsSection",
  () => () => null,
);
jest.mock("../../components/explore-map/ExploreMapSection", () => () => null);
jest.mock("../../components/open-now/OpenNowBusinessesSection", () => {
  const { Text } = jest.requireActual("react-native");
  return function MockSection({
    userLocation,
    isUsingLastLocation,
    onBusinessPress,
  }: {
    userLocation: LocationObject | null;
    isUsingLastLocation: boolean;
    onBusinessPress: (id: number, distance: number, accuracy: number) => void;
  }) {
    return (
      <>
        <Text>{userLocation?.coords.latitude}</Text>
        {isUsingLastLocation && <Text>Using last location</Text>}
        <Text onPress={() => onBusinessPress(42, 0.65, 15)}>
          Open nearby place
        </Text>
      </>
    );
  };
});

it("waits for fresh coordinates before requesting nearby businesses", async () => {
  let resolveLocation!: (value: unknown) => void;
  mockRefreshLocation.mockReturnValue(
    new Promise((resolve) => {
      resolveLocation = resolve;
    }),
  );
  const screen = await render(<ExploreScreen />);
  let refresh!: Promise<void>;
  await act(async () => {
    refresh = screen
      .getByTestId("explore-discovery-scroll")
      .props.refreshControl.props.onRefresh();
  });
  expect(mockRefreshAtLocation).not.toHaveBeenCalled();

  await act(async () => {
    resolveLocation({
      status: "available",
      location: nextLocation,
      error: null,
    });
    await refresh;
  });

  expect(mockRefreshAtLocation).toHaveBeenCalledWith(nextLocation);
  expect(screen.getByText("10.328")).toBeTruthy();
  expect(useOpenNowBusinesses).toHaveBeenLastCalledWith(nextLocation, true);
});

it("keeps the last successful location and labels it after a location failure", async () => {
  mockRefreshLocation.mockResolvedValue({
    status: "unavailable",
    location: null,
    error: new Error("GPS"),
  });
  const screen = await render(<ExploreScreen />);
  await waitFor(() => expect(screen.getByText("10.33")).toBeTruthy());
  await act(async () => {
    await screen
      .getByTestId("explore-discovery-scroll")
      .props.refreshControl.props.onRefresh();
  });

  expect(mockRefreshAtLocation).toHaveBeenCalledWith(mockLocation);
  expect(screen.getByText("Using last location")).toBeTruthy();
});

it("opens the existing business profile with discovery source and distance", async () => {
  const screen = await render(<ExploreScreen />);
  await fireEvent.press(screen.getByText("Open nearby place"));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: {
      businessId: "42",
      profileSource: "EXPLORE_DISCOVERY",
      distance: "0.65",
      distanceAccuracy: "15",
    },
  });
});
