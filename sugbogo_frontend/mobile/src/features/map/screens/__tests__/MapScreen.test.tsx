import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { getMapDiscoveryBusinesses } from "../../api/mapDiscovery.service";
import MapScreen from "../MapScreen";
import { router, useNavigation } from "expo-router";
import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";

const mockSearchPresent = jest.fn();
const mockFilterPresent = jest.fn();
const mockSheetDismiss = jest.fn();

jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: (ref: { current: { present: () => void } }) =>
    ref.current?.present(),
}));
jest.mock("@/features/explore/hooks/useExploreFilterOptions", () => jest.fn());
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../components/MapBusinessSearchSheet", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return function MockSearchSheet(props: { sheetRef: object }) {
    React.useImperativeHandle(props.sheetRef, () => ({
      present: mockSearchPresent,
      dismiss: mockSheetDismiss,
    }));
    return <View testID="map-search-sheet" {...props} />;
  };
});
jest.mock(
  "@/features/explore/components/search-filter-results/SearchFilterBottomSheet",
  () => {
    const React = jest.requireActual("react");
    const { View } = jest.requireActual("react-native");
    return function MockFilterSheet(props: { sheetRef: object }) {
      React.useImperativeHandle(props.sheetRef, () => ({
        present: mockFilterPresent,
        dismiss: mockSheetDismiss,
      }));
      return <View testID="map-filter-sheet" {...props} />;
    };
  },
);

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: jest.fn(),
}));

jest.mock("../../api/mapDiscovery.service", () => ({
  getMapDiscoveryBusinesses: jest.fn(),
}));
jest.mock("@/shared/hooks/useUserLocation", () => jest.fn());
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 80,
}));
jest.mock("../../components/MapControls", () => {
  const { View } = jest.requireActual("react-native");
  return function MockMapControls(props: object) {
    return <View testID="map-controls" {...props} />;
  };
});
jest.mock("../../components/BusinessDiscoveryMap", () => {
  const { View } = jest.requireActual("react-native");
  return function MockDiscoveryMap(props: object) {
    return <View testID="discovery-map" {...props} />;
  };
});
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

const initialBounds = { north: 10.4, south: 10.3, east: 123.95, west: 123.85 };
const nextBounds = { north: 10.42, south: 10.32, east: 123.97, west: 123.87 };
const business = {
  id: 42,
  business_name: "Real Cebu Cafe",
  category: { id: 3, name: "Cafe" },
  cluster: { id: 1, name: "Culinary", icon: "coffee" },
  display_cover_photo_url: null,
  cover_photo_url: null,
  specialty_tags: [
    { id: 4, name: "Local Coffee", color: "blue", icon: "coffee" },
  ],
  location: {
    address: "Real Street",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.35,
    longitude: 123.9,
  },
};

function response(items: object[] = [business], hasNext = false) {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page: 1,
        page_size: 200,
        total_items: hasNext ? 350 : items.length,
        total_pages: hasNext ? 2 : 1,
        has_next: hasNext,
        has_previous: false,
      },
    },
  };
}

const clients: QueryClient[] = [];

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);

  return render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  (useExploreFilterOptions as jest.Mock).mockReturnValue({
    options: {
      clusters: [{ id: 1, name: "Food", icon: "coffee" }],
      categories: [{ id: 3, name: "Cafe", cluster_id: 1 }],
      specialty_tags: [
        { id: 4, name: "Local Coffee", color: "blue", icon: "coffee" },
      ],
    },
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue({ error: null }),
  });
  (useNavigation as jest.Mock).mockReturnValue({ isFocused: () => true });
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "denied",
    location: null,
    isRefreshingLocation: false,
    refreshLocation: jest.fn(),
  });
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue(response());
});

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear());
});

it("fetches initial visible bounds and renders API markers with real selected identity", async () => {
  const screen = await setup();
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );

  await waitFor(() => {
    expect(screen.getByTestId("discovery-map").props.businesses).toEqual([
      { id: 42, latitude: 10.35, longitude: 123.9, is_hidden_gem: false },
    ]);
  });
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledWith(
    initialBounds,
    expect.anything(),
    expect.objectContaining({ categoryIds: [] }),
  );
  await fireEvent(screen.getByTestId("discovery-map"), "businessPress", 42);
  expect(screen.getByText("Real Cebu Cafe")).toBeTruthy();
  expect(screen.getByText("Real Street, Cebu City, Cebu")).toBeTruthy();
});

it("fetches only after Search this area and ignores insignificant camera changes", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));

  await fireEvent(map(), "viewportChange", {
    ...initialBounds,
    north: 10.40001,
  });
  expect(screen.queryByText("Search this area")).toBeNull();
  await fireEvent(map(), "viewportChanging");
  await fireEvent(map(), "viewportChange", nextBounds);
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByText("Search this area"));
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(2),
  );
  expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
    nextBounds,
    expect.anything(),
    expect.objectContaining({ categoryIds: [] }),
  );
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
});

it.each(["denied", "unavailable"])(
  "keeps the map usable when location is %s",
  async (status) => {
    (useUserLocation as jest.Mock).mockReturnValue({ status, location: null });
    const screen = await setup();
    const map = screen.getByTestId("discovery-map");
    const nativeMap = { animateToRegion: jest.fn() };
    await fireEvent(map, "mapReady", nativeMap);
    await fireEvent(map, "viewportChange", initialBounds);
    await waitFor(() =>
      expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1),
    );
    await waitFor(() =>
      expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
        1,
      ),
    );
    expect(map.props.showsUserLocation).toBe(false);
    expect(nativeMap.animateToRegion).not.toHaveBeenCalled();
  },
);

it("centers once near available location and does not recenter on rerender", async () => {
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "available",
    location: { coords: { latitude: 10.32, longitude: 123.91 } },
  });
  const screen = await setup();
  const nativeMap = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", nativeMap);
  expect(nativeMap.animateToRegion).toHaveBeenCalledTimes(1);
  expect(nativeMap.animateToRegion).toHaveBeenCalledWith(
    expect.objectContaining({
      latitude: 10.32,
      longitude: 123.91,
    }),
  );
  expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(
    true,
  );
  await fireEvent(screen.getByTestId("discovery-map"), "businessPress", 42);
  expect(nativeMap.animateToRegion).toHaveBeenCalledTimes(1);
});

it("does not pull the camera away from manual exploration when location arrives late", async () => {
  const locationState = { status: "loading", location: null as unknown };
  (useUserLocation as jest.Mock).mockReturnValue(locationState);
  const screen = await setup();
  const nativeMap = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", nativeMap);
  await fireEvent(screen.getByTestId("discovery-map"), "mapInteraction");
  locationState.status = "available";
  locationState.location = { coords: { latitude: 10.32, longitude: 123.91 } };
  await fireEvent(screen.getByTestId("discovery-map"), "businessPress", 42);
  expect(nativeMap.animateToRegion).not.toHaveBeenCalled();
});

it("waits for initial native centering before committing its viewport", async () => {
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "available",
    location: { coords: { latitude: 10.32, longitude: 123.91 } },
  });
  const screen = await setup();
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", {
    animateToRegion: jest.fn(),
  });
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId("discovery-map"), "viewportChanging");
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    nextBounds,
  );
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledWith(
    nextBounds,
    expect.anything(),
    expect.objectContaining({ categoryIds: [] }),
  );
});

it("keeps the map mounted on failure and retries the failed query", async () => {
  const error = { success: false, code: "NETWORK_ERROR", message: "Offline" };
  (getMapDiscoveryBusinesses as jest.Mock)
    .mockResolvedValueOnce(error)
    .mockResolvedValueOnce(response());
  const screen = await setup();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  await waitFor(() =>
    expect(screen.getByText("Could not load businesses")).toBeTruthy(),
  );
  expect(useQueryErrorNotification).toHaveBeenLastCalledWith(
    expect.objectContaining({ error }),
  );
  await fireEvent.press(screen.getByRole("button", { name: /Tap to retry/i }));
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(2);
});

it("shows empty and incomplete result feedback", async () => {
  (getMapDiscoveryBusinesses as jest.Mock)
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response([business], true));
  const screen = await setup();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  await waitFor(() =>
    expect(
      screen.getByText(
        /No businesses in the searched area|No businesses match these map filters/,
      ),
    ).toBeTruthy(),
  );
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    nextBounds,
  );
  await fireEvent.press(screen.getByText("Search this area"));
  await waitFor(() =>
    expect(screen.getByText(/Showing 1 of 350 businesses/)).toBeTruthy(),
  );
});

it("rejects oversized viewports without requests and recovers after zooming in", async () => {
  const screen = await setup();
  await fireEvent(screen.getByTestId("discovery-map"), "viewportChange", {
    ...initialBounds,
    north: 11,
  });
  expect(screen.getByText("Zoom in to search this area")).toBeTruthy();
  expect(screen.queryByText("Search this area")).toBeNull();
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1),
  );
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
});

it("handles a server viewport cap without retries or a generic error toast", async () => {
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue({
    success: false,
    code: "VALIDATION_ERROR",
    errors: { bounds: ["Zoom in"] },
  });
  const screen = await setup();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  await waitFor(() =>
    expect(screen.getByText("Zoom in to search this area")).toBeTruthy(),
  );
  expect(useQueryErrorNotification).toHaveBeenLastCalledWith(
    expect.objectContaining({ error: null }),
  );
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
});

it("does not let a stale response replace the current searched area's markers", async () => {
  let resolveOld: (value: unknown) => void = () => {};
  (getMapDiscoveryBusinesses as jest.Mock)
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    )
    .mockResolvedValueOnce(response([{ ...business, id: 99 }]));
  const screen = await setup();
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1),
  );
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    nextBounds,
  );
  await fireEvent.press(screen.getByText("Search this area"));
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses[0]?.id).toBe(
      99,
    ),
  );
  await act(async () => {
    resolveOld(response());
  });
  expect(screen.getByTestId("discovery-map").props.businesses[0].id).toBe(99);
});

it("switches and dismisses previews without fetching or moving the map and opens the real profile", async () => {
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue(
    response([
      business,
      { ...business, id: 77, business_name: "Another Cebu Cafe" },
    ]),
  );
  const screen = await setup();
  const nativeMap = { animateToRegion: jest.fn(), animateCamera: jest.fn() };
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "mapReady", nativeMap);
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(2));
  await fireEvent(map(), "businessPress", 42);
  expect(map().props.selectedBusinessId).toBe(42);
  expect(screen.getByText("Real Cebu Cafe")).toBeTruthy();
  await fireEvent(map(), "businessPress", 77);
  expect(map().props.selectedBusinessId).toBe(77);
  expect(screen.queryByText("Real Cebu Cafe")).toBeNull();
  await fireEvent.press(screen.getByText("View Business"));
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: { businessId: "77" },
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Close business preview" }),
  );
  expect(map().props.selectedBusinessId).toBeNull();
  expect(screen.queryByText("View Business")).toBeNull();
  expect(nativeMap.animateToRegion).not.toHaveBeenCalled();
  expect(nativeMap.animateCamera).not.toHaveBeenCalled();
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
});

it("clears a disappeared selection permanently when refreshed results no longer contain it", async () => {
  (getMapDiscoveryBusinesses as jest.Mock)
    .mockResolvedValueOnce(response())
    .mockResolvedValueOnce(response([]))
    .mockResolvedValueOnce(response());
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent(map(), "businessPress", 42);
  expect(screen.getByText("Real Cebu Cafe")).toBeTruthy();
  await act(async () => {
    await clients[0].invalidateQueries({ queryKey: ["map-discovery"] });
  });
  await waitFor(() => expect(map().props.businesses).toHaveLength(0));
  expect(map().props.selectedBusinessId).toBeNull();
  expect(screen.queryByText("Real Cebu Cafe")).toBeNull();
  await act(async () => {
    await clients[0].invalidateQueries({ queryKey: ["map-discovery"] });
  });
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  expect(map().props.selectedBusinessId).toBeNull();
  expect(screen.queryByText("View Business")).toBeNull();
});

it("does not navigate after the map screen loses focus", async () => {
  (useNavigation as jest.Mock).mockReturnValue({ isFocused: () => false });
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent(map(), "businessPress", 42);
  await fireEvent.press(screen.getByText("View Business"));
  expect(router.push).not.toHaveBeenCalled();
});

it("passes the backend gem flag to map markers and shows the selected business's gem label", async () => {
  (getMapDiscoveryBusinesses as jest.Mock).mockResolvedValue(
    response([
      { ...business, is_hidden_gem: true },
      {
        ...business,
        id: 77,
        business_name: "Regular Cafe",
        is_hidden_gem: false,
      },
    ]),
  );
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(2));
  expect(
    map().props.businesses.map(
      (marker: { is_hidden_gem: boolean }) => marker.is_hidden_gem,
    ),
  ).toEqual([true, false]);
  await fireEvent(map(), "businessPress", 42);
  expect(screen.getByText("Hidden Gem")).toBeTruthy();
  await fireEvent(map(), "businessPress", 77);
  expect(screen.queryByText("Hidden Gem")).toBeNull();
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
});

it("applies taxonomy to the viewed area and preserves all filters through area search and clearing", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent(map(), "viewportChange", nextBounds);
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole("button", { name: /^Map filters/ }));
  expect(mockFilterPresent).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId("map-filter-sheet"), "change", {
    search: "",
    clusterId: 1,
    categoryIds: [3],
    specialtyTagId: 4,
  });
  await fireEvent(screen.getByTestId("map-filter-sheet"), "apply");
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
      nextBounds,
      expect.anything(),
      expect.objectContaining({
        clusterId: 1,
        categoryIds: [3],
        specialtyTagId: 4,
      }),
    ),
  );
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: "Hidden Gems" }));
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
      nextBounds,
      expect.anything(),
      expect.objectContaining({
        clusterId: 1,
        categoryIds: [3],
        specialtyTagId: 4,
        hiddenGems: true,
      }),
    ),
  );
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  const moved = { north: 10.45, south: 10.35, east: 123.99, west: 123.89 };
  const previousCalls = (getMapDiscoveryBusinesses as jest.Mock).mock.calls
    .length;
  await fireEvent(map(), "viewportChange", moved);
  expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(previousCalls);
  await fireEvent.press(screen.getByText("Search this area"));
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
      moved,
      expect.anything(),
      expect.objectContaining({ categoryIds: [3], hiddenGems: true }),
    ),
  );
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear map filters" }),
  );
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
      moved,
      expect.anything(),
      expect.objectContaining({
        clusterId: null,
        categoryIds: [],
        specialtyTagId: null,
        hiddenGems: false,
        openNow: false,
      }),
    ),
  );
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
});

it("selects a distant global result, commits the destination area, and keeps map filters", async () => {
  const target = {
    ...business,
    id: 900,
    business_name: "Distant Cafe",
    is_hidden_gem: false,
    location: { ...business.location, latitude: 10.8, longitude: 123.8 },
  };
  (getMapDiscoveryBusinesses as jest.Mock).mockImplementation(
    async (_bounds, _signal, filters) => {
      if (filters.businessId === 900) {
        return response([target]);
      }
      return response(filters.hiddenGems ? [] : [business]);
    },
  );
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  const nativeMap = { animateToRegion: jest.fn() };
  await fireEvent(map(), "mapReady", nativeMap);
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: "Hidden Gems" }));
  await waitFor(() =>
    expect(
      screen.getByText(
        /No businesses in the searched area|No businesses match these map filters/,
      ),
    ).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Search SugboGo businesses" }),
  );
  expect(mockSearchPresent).toHaveBeenCalledTimes(1);
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  expect(nativeMap.animateToRegion).toHaveBeenCalledWith({
    latitude: 10.8,
    longitude: 123.8,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
  await waitFor(() => expect(screen.getByText("Distant Cafe")).toBeTruthy());
  expect(map().props.selectedBusinessId).toBe(900);
  expect(
    screen.getByText(/shown separately from the active map filters/),
  ).toBeTruthy();
  const destinationBounds = {
    north: 10.81,
    south: 10.79,
    east: 123.81,
    west: 123.79,
  };
  await fireEvent(map(), "viewportChanging");
  await fireEvent(map(), "viewportChange", destinationBounds);
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(
      destinationBounds,
      expect.anything(),
      expect.objectContaining({ hiddenGems: true }),
    ),
  );
  expect(map().props.selectedBusinessId).toBe(900);
  await waitFor(() =>
    expect(screen.queryByText("Loading businesses…")).toBeNull(),
  );
});

it("does not request an oversized viewed region when filters change", async () => {
  const screen = await setup();
  await fireEvent(screen.getByTestId("discovery-map"), "viewportChange", {
    ...initialBounds,
    north: 12,
  });
  await fireEvent.press(screen.getByRole("button", { name: "Open Now" }));
  expect(getMapDiscoveryBusinesses).not.toHaveBeenCalled();
  expect(screen.getByText("Zoom in to search this area")).toBeTruthy();
});

it("keeps a newer global selection when an older compact lookup resolves late", async () => {
  let finishOld: (value: unknown) => void = () => {};
  const target = { ...business, id: 901, business_name: "Newest Selection" };
  (getMapDiscoveryBusinesses as jest.Mock).mockImplementation(
    async (_bounds, _signal, filters) => {
      if (filters.businessId === 900) {
        return new Promise((resolve) => {
          finishOld = resolve;
        });
      }
      return response(filters.businessId === 901 ? [target] : [business]);
    },
  );
  const screen = await setup();
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", {
    animateToRegion: jest.fn(),
  });
  await fireEvent(screen.getByTestId("map-search-sheet"), "businessSelect", {
    ...business,
    id: 900,
  });
  await waitFor(() =>
    expect(getMapDiscoveryBusinesses).toHaveBeenCalledTimes(1),
  );
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  await waitFor(() =>
    expect(screen.getByText("Newest Selection")).toBeTruthy(),
  );
  await act(async () => {
    finishOld(response([{ ...business, id: 900 }]));
  });
  expect(screen.getByTestId("discovery-map").props.selectedBusinessId).toBe(
    901,
  );
  expect(screen.getByText("Newest Selection")).toBeTruthy();
});

it("retries a failed compact search selection without resetting the camera", async () => {
  let lookupCalls = 0;
  const target = { ...business, id: 900, business_name: "Recovered Selection" };
  (getMapDiscoveryBusinesses as jest.Mock).mockImplementation(
    async (_bounds, _signal, filters) => {
      if (filters.businessId === 900) {
        lookupCalls += 1;
        return lookupCalls === 1
          ? { success: false, code: "NETWORK_ERROR", message: "Offline" }
          : response([target]);
      }
      return response();
    },
  );
  const screen = await setup();
  const nativeMap = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", nativeMap);
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  await waitFor(() =>
    expect(screen.getByText("Could not load selected business")).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", {
      name: /Could not load selected business.*retry/i,
    }),
  );
  await waitFor(() =>
    expect(screen.getByText("Recovered Selection")).toBeTruthy(),
  );
  expect(nativeMap.animateToRegion).toHaveBeenCalledTimes(1);
});

it("offers recovery when taxonomy options fail to load", async () => {
  const refetch = jest
    .fn()
    .mockResolvedValueOnce({ error: { code: "NETWORK_ERROR" } })
    .mockResolvedValueOnce({ error: null });
  (useExploreFilterOptions as jest.Mock).mockReturnValue({
    options: { clusters: [], categories: [], specialty_tags: [] },
    isLoading: false,
    error: { code: "NETWORK_ERROR" },
    refetch,
  });
  const screen = await setup();
  await fireEvent.press(screen.getByRole("button", { name: /^Map filters/ }));
  await waitFor(() =>
    expect(screen.getByText("Could not load filters")).toBeTruthy(),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: /Could not load filters.*retry/i }),
  );
  await waitFor(() => expect(mockFilterPresent).toHaveBeenCalledTimes(1));
  expect(refetch).toHaveBeenCalledTimes(2);
});

it("reads current native map boundaries when applying a quick filter", async () => {
  const screen = await setup();
  const actualBounds = { north: 10.5, south: 10.4, east: 124, west: 123.9 };
  const map = () => screen.getByTestId("discovery-map");
  await fireEvent(map(), "mapReady", {
    animateToRegion: jest.fn(),
    getMapBoundaries: jest.fn().mockResolvedValue({
      northEast: { latitude: actualBounds.north, longitude: actualBounds.east },
      southWest: { latitude: actualBounds.south, longitude: actualBounds.west },
    }),
  });
  await fireEvent(map(), "viewportChange", initialBounds);
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: "Open Now" }));
  await waitFor(() => expect(getMapDiscoveryBusinesses).toHaveBeenLastCalledWith(actualBounds, expect.anything(), expect.objectContaining({ openNow: true })));
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
});
