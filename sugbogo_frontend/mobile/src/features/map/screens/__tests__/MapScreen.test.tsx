import React from "react";
import type { LocationObject } from "expo-location";
import * as Location from "expo-location";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { Alert, AppState, Linking, type AppStateStatus } from "react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { getMapDirectoryPage } from "../../api/mapDiscovery.service";
import MapScreen from "../MapScreen";
import { router, useNavigation } from "expo-router";
import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";

let mockScreenFocused = true;
const mockSearchPresent = jest.fn();
const mockFilterPresent = jest.fn();
const mockSheetDismiss = jest.fn();
const mockAppListeners = new Set<(state: AppStateStatus) => void>();

jest.mock("expo-location", () => ({
  Accuracy: { High: 6 },
  PermissionStatus: {
    GRANTED: "granted",
    DENIED: "denied",
    UNDETERMINED: "undetermined",
  },
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

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
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual("react").useEffect(() => {
      if (mockScreenFocused) {
        return effect();
      }
    }, [effect, mockScreenFocused]);
  },
  useIsFocused: () => mockScreenFocused,
  useNavigation: jest.fn(),
}));

jest.mock("../../api/mapDiscovery.service", () => ({
  getMapDirectoryPage: jest.fn(),
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
const {
  default: useSharedUserLocation,
  USER_LOCATION_QUERY_KEY,
  RECENT_LOCATION_MAX_AGE_MS,
} = jest.requireActual<typeof import("@/shared/hooks/useUserLocation")>(
  "@/shared/hooks/useUserLocation",
);

function setup(existingClient?: QueryClient) {
  const client =
    existingClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
  clients.push(client);

  return render(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
}

type LocationResult = Awaited<
  ReturnType<ReturnType<typeof useUserLocation>["refreshLocation"]>
>;
type MapTestScreen = Awaited<ReturnType<typeof setup>>;

const availableLocation: LocationResult = {
  status: "available",
  location: {
    coords: { latitude: 10.33, longitude: 123.91 },
  } as LocationObject,
  error: null,
};
const deniedLocation: LocationResult = {
  status: "denied",
  location: null,
  error: null,
};

function deferredLocation() {
  let resolve!: (result: LocationResult) => void;
  const promise = new Promise<LocationResult>((complete) => {
    resolve = complete;
  });

  return { promise, resolve };
}

async function setupLocateMe(refreshLocation: jest.Mock) {
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "denied",
    location: null,
    isRefreshingLocation: false,
    refreshLocation,
  });
  const screen = await setup();
  const camera = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", camera);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );

  return { screen, camera };
}

async function changeMapFocus(
  screen: MapTestScreen,
  focused: boolean,
) {
  mockScreenFocused = focused;
  const client = clients[clients.length - 1];
  await screen.rerender(
    <QueryClientProvider client={client}>
      <MapScreen />
    </QueryClientProvider>,
  );
}

function recentFix(): LocationObject {
  return {
    timestamp: Date.now(),
    coords: { latitude: 10.33, longitude: 123.91, accuracy: 20 },
  } as LocationObject;
}

function cachedLocationClient(location = recentFix()) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  client.setQueryData(USER_LOCATION_QUERY_KEY, {
    status: "available",
    location,
    error: null,
  });
  return client;
}

async function setupSharedLocation(client?: QueryClient) {
  jest.mocked(useUserLocation).mockImplementation(useSharedUserLocation);
  const screen = await setup(client);
  const camera = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", camera);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  return { screen, camera };
}

async function changeAppState(state: AppStateStatus) {
  await act(async () => {
    AppState.currentState = state;
    mockAppListeners.forEach((listener) => listener(state));
    // The root QueryLifecycle maps these same native events to React Query.
    focusManager.setFocused(state === "active");
  });
}

beforeEach(() => {
  mockScreenFocused = true;
  AppState.currentState = "active";
  focusManager.setFocused(true);
  mockAppListeners.clear();
  jest.spyOn(AppState, "addEventListener").mockImplementation(
    (_event, callback) => {
      mockAppListeners.add(callback);
      return { remove: () => mockAppListeners.delete(callback) };
    },
  );
  jest.mocked(Location.getForegroundPermissionsAsync)
    .mockReset()
    .mockResolvedValue({ status: "granted" } as never);
  jest.mocked(Location.requestForegroundPermissionsAsync)
    .mockReset()
    .mockResolvedValue({ status: "granted" } as never);
  jest.mocked(Location.getCurrentPositionAsync)
    .mockReset()
    .mockImplementation(async () => recentFix());
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
  (useNavigation as jest.Mock).mockReturnValue({
    isFocused: () => mockScreenFocused,
  });
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "denied",
    location: null,
    isRefreshingLocation: false,
    refreshLocation: jest.fn(),
  });
  (getMapDirectoryPage as jest.Mock).mockResolvedValue(response());
});

afterEach(() => {
  jest.restoreAllMocks();
  clients.splice(0).forEach((client) => client.clear());
  focusManager.setFocused(true);
});

it("loads immediately without bounds and never requests data during map movement", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
  await fireEvent(map(), "viewportChange", initialBounds);
  await fireEvent(map(), "mapInteraction");
  await fireEvent(map(), "viewportChange", nextBounds);
  await fireEvent(map(), "viewportChange", {
    north: 80,
    south: -80,
    east: 170,
    west: -170,
  });
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("Search this area")).toBeNull();
  expect(screen.queryByText("Zoom in to search this area")).toBeNull();
});

it("selects real identity, navigates to the existing profile, and restores controls on dismissal", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  const reservedInset = map().props.previewBottomInset;
  expect(reservedInset).toBeUndefined();
  await fireEvent(screen.getByTestId("map-search-header"), "layout", {
    nativeEvent: { layout: { y: 12, height: 48 } },
  });
  await fireEvent(map(), "businessPress", 42);
  expect(map().props.previewBottomInset).toBe(reservedInset);
  expect(screen.getByText("Cebu City, Cebu")).toBeTruthy();
  expect(map().props.selectedBusinessId).toBe(42);
  expect(map().props.manageMarkerCamera).toBe(true);
  expect(map().props.focusTarget).toEqual({
    id: 42,
    latitude: 10.35,
    longitude: 123.9,
    preserveZoom: true,
  });
  expect(map().props.dimUnselectedMarkers).toBe(true);
  expect(map().props.focusInsets.ready).toBe(false);
  expect(screen.queryByRole("button", { name: "Open Now" })).toBeNull();
  await fireEvent(screen.getByTestId("business-preview-anchor"), "layout", {
    nativeEvent: { layout: { height: 180 } },
  });
  expect(screen.getByTestId("map-controls").props.bottomOffset).toBe(272);
  expect(map().props.focusInsets).toEqual({
    top: 72,
    bottom: 272,
    ready: true,
  });
  expect(map().props.previewBottomInset).toBe(reservedInset);
  await fireEvent(screen.getByTestId("business-preview-anchor"), "layout", {
    nativeEvent: { layout: { height: 220 } },
  });
  expect(map().props.previewBottomInset).toBe(reservedInset);
  expect(screen.getByTestId("map-controls").props.bottomOffset).toBe(312);
  await fireEvent.press(
    screen.getByRole("button", {
      name: /View Real Cebu Cafe business profile/,
    }),
  );
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: { businessId: "42", profileSource: "MAP" },
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Close business preview" }),
  );
  expect(map().props.selectedBusinessId).toBeNull();
  expect(map().props.focusTarget).toBeNull();
  expect(map().props.previewBottomInset).toBe(reservedInset);
  expect(screen.getByRole("button", { name: "Open Now" })).toBeTruthy();
  expect(screen.getByTestId("map-controls").props.bottomOffset).toBe(80);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
});

it("applies and clears taxonomy and Hidden Gems locally", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  const sheet = () => screen.getByTestId("map-filter-sheet");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: /^Map filters/ }));
  expect(mockFilterPresent).toHaveBeenCalledTimes(1);
  await fireEvent(sheet(), "change", {
    search: "",
    clusterId: 1,
    categoryIds: [3, 9],
    specialtyTagId: 4,
  });
  await fireEvent(sheet(), "apply");
  expect(map().props.businesses).toHaveLength(1);
  await fireEvent(sheet(), "change", {
    search: "",
    clusterId: 1,
    categoryIds: [3],
    specialtyTagId: 99,
  });
  await fireEvent(sheet(), "apply");
  expect(map().props.businesses).toHaveLength(0);
  expect(screen.getByText(/No businesses match/)).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: /^Clear(?: \d+)? map filters?$/ }),
  );
  expect(map().props.businesses).toHaveLength(1);
  await fireEvent.press(screen.getByRole("button", { name: "Hidden Gems" }));
  expect(map().props.businesses).toHaveLength(0);
  await fireEvent.press(
    screen.getByRole("button", { name: /^Clear(?: \d+)? map filters?$/ }),
  );
  expect(map().props.businesses).toHaveLength(1);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
});

it("uses server Open Now IDs and restores the cached directory when cleared", async () => {
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      response(options.openNow ? [] : [business]),
  );
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: "Open Now" }));
  await waitFor(() =>
    expect(screen.getByText(/No businesses match/)).toBeTruthy(),
  );
  expect(map().props.businesses).toHaveLength(0);
  await fireEvent.press(
    screen.getByRole("button", { name: /^Clear(?: \d+)? map filters?$/ }),
  );
  expect(map().props.businesses).toHaveLength(1);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(2);
});

it("keeps the map visible on failure and retries the directory", async () => {
  (getMapDirectoryPage as jest.Mock).mockResolvedValueOnce({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByText("Could not load businesses")).toBeTruthy(),
  );
  expect(screen.getByTestId("discovery-map")).toBeTruthy();
  expect(screen.queryByText("No businesses are available yet.")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: /Could not load businesses.*retry/i }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  expect(useQueryErrorNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      toastId: "map-discovery-error",
      error: expect.objectContaining({ code: "NETWORK_ERROR" }),
    }),
  );
});

it("shows the empty-directory state", async () => {
  (getMapDirectoryPage as jest.Mock).mockResolvedValue(response([]));
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByText("No businesses are available yet.")).toBeTruthy(),
  );
});

it("reports Open Now errors separately and retries without refetching the base directory", async () => {
  let fail = true;
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      options.openNow && fail
        ? { success: false, code: "NETWORK_ERROR", message: "Offline" }
        : response(),
  );
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Open Now" }));
  await waitFor(() =>
    expect(screen.getByText("Could not check opening hours")).toBeTruthy(),
  );
  expect(screen.queryByText(/No businesses match/)).toBeNull();
  fail = false;
  await fireEvent.press(
    screen.getByRole("button", {
      name: /Could not check opening hours.*retry/i,
    }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  expect(
    (getMapDirectoryPage as jest.Mock).mock.calls.filter(
      (call) => !call[2].openNow,
    ),
  ).toHaveLength(1);
});

it("resolves search from the complete cache, pins a filtered business once, and acknowledges native focus", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent.press(screen.getByRole("button", { name: "Hidden Gems" }));
  expect(map().props.businesses).toHaveLength(0);
  await fireEvent.press(
    screen.getByRole("button", { name: "Search SugboGo businesses" }),
  );
  expect(mockSearchPresent).toHaveBeenCalledTimes(1);
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    business,
  );
  expect(map().props.businesses).toHaveLength(1);
  expect(map().props.focusTarget).toEqual({
    id: 42,
    latitude: 10.35,
    longitude: 123.9,
  });
  expect(map().props.selectedBusinessId).toBe(42);
  await fireEvent(map(), "viewportChange", initialBounds);
  expect(map().props.focusTarget).not.toBeNull();
  await fireEvent(map(), "focusStart");
  await fireEvent(map(), "viewportChange", initialBounds);
  expect(map().props.focusTarget).toBeNull();
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
  await fireEvent(map(), "mapInteraction");
  await fireEvent(map(), "viewportChange", nextBounds);
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
});

it("falls back to a global compact lookup for a result missing from the cached directory", async () => {
  const target = {
    ...business,
    id: 900,
    business_name: "Distant Cafe",
    location: { ...business.location, latitude: 11.2 },
  };
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      response(options.businessId ? [target] : [business]),
  );
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  await waitFor(() => expect(screen.getByText("Distant Cafe")).toBeTruthy());
  expect(screen.getByTestId("discovery-map").props.selectedBusinessId).toBe(
    900,
  );
  expect(getMapDirectoryPage).toHaveBeenLastCalledWith(1, expect.anything(), {
    businessId: 900,
  });
});

it("ignores an older selection response", async () => {
  let finishOld: (value: unknown) => void = () => {};
  const target = { ...business, id: 901, business_name: "Latest Selection" };
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) => {
      if (options.businessId === 900)
        return new Promise((resolve) => {
          finishOld = resolve;
        });
      return response(options.businessId ? [target] : [business]);
    },
  );
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(screen.getByTestId("map-search-sheet"), "businessSelect", {
    ...business,
    id: 900,
  });
  await waitFor(() => expect(getMapDirectoryPage).toHaveBeenCalledTimes(2));
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  await waitFor(() =>
    expect(screen.getByText("Latest Selection")).toBeTruthy(),
  );
  await act(async () => finishOld(response([{ ...business, id: 900 }])));
  expect(screen.getByTestId("discovery-map").props.selectedBusinessId).toBe(
    901,
  );
});

it("retries a failed selection lookup without repeating camera focus", async () => {
  let fail = true;
  const target = { ...business, id: 900, business_name: "Recovered Selection" };
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) => {
      if (options.businessId) {
        return fail
          ? { success: false, code: "NETWORK_ERROR", message: "Offline" }
          : response([target]);
      }
      return response();
    },
  );
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    target,
  );
  await waitFor(() =>
    expect(screen.getByText("Could not load selected business")).toBeTruthy(),
  );
  await fireEvent(screen.getByTestId("discovery-map"), "focusStart");
  await fireEvent(
    screen.getByTestId("discovery-map"),
    "viewportChange",
    initialBounds,
  );
  fail = false;
  await fireEvent.press(
    screen.getByRole("button", {
      name: /Could not load selected business.*retry/i,
    }),
  );
  await waitFor(() =>
    expect(screen.getByText("Recovered Selection")).toBeTruthy(),
  );
  expect(screen.getByTestId("discovery-map").props.focusTarget).toBeNull();
});

it("clears a search selection when the server says the business is unavailable", async () => {
  (getMapDirectoryPage as jest.Mock).mockImplementation(
    async (_page, _signal, options) =>
      response(options.businessId ? [] : [business]),
  );
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(screen.getByTestId("map-search-sheet"), "businessSelect", {
    ...business,
    id: 900,
  });
  await waitFor(() =>
    expect(
      screen.getByText(/This business is no longer available/),
    ).toBeTruthy(),
  );
  expect(
    screen.getByTestId("discovery-map").props.selectedBusinessId,
  ).toBeNull();
  expect(screen.getByTestId("discovery-map").props.focusTarget).toBeNull();
});

it.each(["denied", "unavailable"])(
  "loads the directory without location permission: %s",
  async (status) => {
    (useUserLocation as jest.Mock).mockReturnValue({
      status,
      location: null,
      refreshLocation: jest.fn(),
    });
    const screen = await setup();
    await waitFor(() =>
      expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
        1,
      ),
    );
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(
      false,
    );
  },
);

it("centers on available location once and does not override a search selection", async () => {
  const location = { coords: { latitude: 10.3, longitude: 123.9 } };
  (useUserLocation as jest.Mock).mockReturnValue({
    status: "available",
    location,
    refreshLocation: jest.fn(),
  });
  const screen = await setup();
  const camera = { animateToRegion: jest.fn() };
  await fireEvent(screen.getByTestId("discovery-map"), "mapReady", camera);
  expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(
    screen.getByTestId("map-search-sheet"),
    "businessSelect",
    business,
  );
  expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("discovery-map").props.focusTarget.id).toBe(42);
});

it("forwards tab focus without reloading the directory or clearing selection", async () => {
  const screen = await setup();
  const map = () => screen.getByTestId("discovery-map");
  await waitFor(() => expect(map().props.businesses).toHaveLength(1));
  await fireEvent(map(), "businessPress", 42);
  const client = clients[clients.length - 1];
  for (const focused of [false, true, false, true]) {
    mockScreenFocused = focused;
    await screen.rerender(
      <QueryClientProvider client={client}>
        <MapScreen />
      </QueryClientProvider>,
    );
    expect(map().props.isScreenFocused).toBe(focused);
    expect(map().props.selectedBusinessId).toBe(42);
  }
  expect(getMapDirectoryPage).toHaveBeenCalledTimes(1);
});

it("ignores a Locate Me result after a manual map gesture", async () => {
  const request = deferredLocation();
  const refreshLocation = jest.fn(() => request.promise);
  const { screen, camera } = await setupLocateMe(refreshLocation);
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  expect(refreshLocation).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId("discovery-map"), "mapInteraction");
  await act(async () => {
    request.resolve(availableLocation);
    await request.promise;
  });

  expect(camera.animateToRegion).not.toHaveBeenCalled();
});

it.each(["marker", "search"])(
  "preserves a newer %s selection when Locate Me resolves",
  async (selection) => {
    const request = deferredLocation();
    const { screen, camera } = await setupLocateMe(
      jest.fn(() => request.promise),
    );
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    if (selection === "marker") {
      await fireEvent(screen.getByTestId("discovery-map"), "businessPress", 42);
    } else {
      await fireEvent(
        screen.getByTestId("map-search-sheet"),
        "businessSelect",
        business,
      );
    }
    await act(async () => {
      request.resolve(availableLocation);
      await request.promise;
    });

    expect(camera.animateToRegion).not.toHaveBeenCalled();
    expect(screen.getByTestId("discovery-map").props.selectedBusinessId).toBe(
      42,
    );
    expect(screen.getByTestId("discovery-map").props.focusTarget.id).toBe(42);
    expect(screen.getByText(business.business_name)).toBeTruthy();
  },
);

it.each(["blur", "blur and return", "unmount"])(
  "ignores Locate Me failure feedback after %s",
  async (transition) => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const request = deferredLocation();
    const { screen, camera } = await setupLocateMe(
      jest.fn(() => request.promise),
    );
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    if (transition === "unmount") {
      await screen.unmount();
    } else {
      await changeMapFocus(screen, false);
      if (transition === "blur and return") {
        await changeMapFocus(screen, true);
      }
    }
    await act(async () => {
      request.resolve(deniedLocation);
      await request.promise;
    });

    expect(alert).not.toHaveBeenCalled();
    expect(camera.animateToRegion).not.toHaveBeenCalled();
  },
);

it.each(["blur", "blur and return", "unmount"])(
  "ignores Locate Me camera movement after %s",
  async (transition) => {
    const request = deferredLocation();
    const { screen, camera } = await setupLocateMe(
      jest.fn(() => request.promise),
    );
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    if (transition === "unmount") {
      await screen.unmount();
    } else {
      await changeMapFocus(screen, false);
      if (transition === "blur and return") {
        await changeMapFocus(screen, true);
      }
    }
    await act(async () => {
      request.resolve(availableLocation);
      await request.promise;
    });

    expect(camera.animateToRegion).not.toHaveBeenCalled();
  },
);

it.each([
  { outcome: "success", result: availableLocation },
  { outcome: "failure", result: deniedLocation },
])(
  "blocks repeated Locate Me presses while pending and allows another action after $outcome",
  async ({ result }) => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const olderRequest = deferredLocation();
    const newerRequest = deferredLocation();
    const refreshLocation = jest
      .fn()
      .mockReturnValueOnce(olderRequest.promise)
      .mockReturnValueOnce(newerRequest.promise);
    const { screen, camera } = await setupLocateMe(refreshLocation);
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    expect(refreshLocation).toHaveBeenCalledTimes(1);
    await act(async () => {
      olderRequest.resolve(result);
      await olderRequest.promise;
    });
    camera.animateToRegion.mockClear();
    alert.mockClear();
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    expect(refreshLocation).toHaveBeenCalledTimes(2);
    await act(async () => {
      newerRequest.resolve(availableLocation);
      await newerRequest.promise;
    });

    expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  },
);

it("recenters for a Locate Me action that remains current", async () => {
  const request = deferredLocation();
  const { screen, camera } = await setupLocateMe(
    jest.fn(() => request.promise),
  );
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  expect(camera.animateToRegion).not.toHaveBeenCalled();
  await act(async () => {
    request.resolve(availableLocation);
    await request.promise;
  });

  expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).toHaveBeenCalledWith({
    latitude: availableLocation.location!.coords.latitude,
    longitude: availableLocation.location!.coords.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
});

it("keeps location failure feedback for a Locate Me action that remains current", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const request = deferredLocation();
  const { screen, camera } = await setupLocateMe(
    jest.fn(() => request.promise),
  );
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  await act(async () => {
    request.resolve(deniedLocation);
    await request.promise;
  });

  expect(camera.animateToRegion).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith(
    "Location Permission Needed",
    expect.any(String),
    expect.arrayContaining([expect.objectContaining({ text: "Open Settings" })]),
  );
});

it("dispatches View Business once for rapid presses and releases the guard on return", async () => {
  const screen = await setup();
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(
      1,
    ),
  );
  await fireEvent(screen.getByTestId("discovery-map"), "businessPress", 42);
  const viewBusinessButton = screen.getByRole("button", {
    name: /View Real Cebu Cafe business profile/,
  });
  await fireEvent.press(viewBusinessButton);
  await fireEvent.press(viewBusinessButton);
  await fireEvent.press(viewBusinessButton);
  expect(router.push).toHaveBeenCalledTimes(1);
  expect(router.push).toHaveBeenCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: { businessId: "42", profileSource: "MAP" },
  });

  await changeMapFocus(screen, false);
  await fireEvent.press(viewBusinessButton);
  expect(router.push).toHaveBeenCalledTimes(1);
  await changeMapFocus(screen, true);
  await fireEvent.press(
    screen.getByRole("button", {
      name: /View Real Cebu Cafe business profile/,
    }),
  );
  expect(router.push).toHaveBeenCalledTimes(2);
  expect(router.push).toHaveBeenLastCalledWith({
    pathname: "/(explorer)/business/[businessId]",
    params: { businessId: "42", profileSource: "MAP" },
  });
});

it("reuses Explore's acquired fix on Map mount and focus without acquiring GPS again", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const explore = await renderHook(
    () => useSharedUserLocation({ mode: "recent" }),
    {
      wrapper: ({ children }: React.PropsWithChildren) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    },
  );
  await waitFor(() => expect(explore.result.current.status).toBe("available"));
  const exploreFix = explore.result.current.location;
  await explore.unmount();

  const { screen, camera } = await setupSharedLocation(client);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  expect(screen.getByTestId("discovery-map").props.userLocation).toEqual(exploreFix);
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
  camera.animateToRegion.mockClear();
  await fireEvent(screen.getByTestId("discovery-map"), "mapInteraction");

  for (let visit = 0; visit < 2; visit += 1) {
    const permissionChecks = jest.mocked(Location.getForegroundPermissionsAsync)
      .mock.calls.length;
    await changeMapFocus(screen, false);
    await changeMapFocus(screen, true);
    await waitFor(() =>
      expect(jest.mocked(Location.getForegroundPermissionsAsync).mock.calls.length)
        .toBeGreaterThan(permissionChecks),
    );
    await waitFor(() =>
      expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
    );
  }
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).not.toHaveBeenCalled();
});

it("replaces an expired passive fix through the existing acquisition path", async () => {
  const expired = {
    ...recentFix(),
    timestamp: Date.now() - RECENT_LOCATION_MAX_AGE_MS,
  };
  const client = cachedLocationClient(expired);
  const { screen } = await setupSharedLocation(client);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
    accuracy: Location.Accuracy.High,
  });
  expect(screen.getByTestId("discovery-map").props.userLocation.timestamp)
    .toBeGreaterThan(expired.timestamp);
});

it("rejects a revoked cached permission quietly on Map mount and return", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    status: "denied",
  } as never);
  const { screen, camera } = await setupSharedLocation(cachedLocationClient());
  await waitFor(() =>
    expect(screen.getByTestId("map-controls").props.isLocating).toBe(false),
  );
  await changeMapFocus(screen, false);
  await changeMapFocus(screen, true);
  await waitFor(() =>
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(2),
  );
  expect(screen.getByTestId("discovery-map").props.userLocation).toBeNull();
  expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(false);
  expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  expect(camera.animateToRegion).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

it("explicit Locate Me acquires a fresh position despite a valid passive fix", async () => {
  const client = cachedLocationClient();
  const { screen, camera } = await setupSharedLocation(client);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  camera.animateToRegion.mockClear();
  const moved = recentFix();
  moved.coords.latitude = 10.41;
  jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(moved);
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  await waitFor(() => expect(camera.animateToRegion).toHaveBeenCalledTimes(1));
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).toHaveBeenCalledWith({
    latitude: moved.coords.latitude,
    longitude: moved.coords.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
  expect(client.getQueryData(USER_LOCATION_QUERY_KEY)).toMatchObject({
    status: "available",
    location: moved,
  });
});

it("keeps discovery interactive during explicit acquisition and caches a gesture-superseded fix", async () => {
  const client = cachedLocationClient();
  const { screen, camera } = await setupSharedLocation(client);
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  camera.animateToRegion.mockClear();
  let finishLocation!: (location: LocationObject) => void;
  jest.mocked(Location.getCurrentPositionAsync).mockReturnValueOnce(
    new Promise((resolve) => {
      finishLocation = resolve;
    }),
  );
  const locateMe = screen.getByTestId("map-controls").props.onLocateMe;
  await act(() => {
    locateMe();
    locateMe();
    locateMe();
  });
  await waitFor(() =>
    expect(screen.getByTestId("map-controls").props.isLocating).toBe(true),
  );
  await waitFor(() =>
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1),
  );
  expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(1);
  expect(screen.getByTestId("discovery-map").props.interactive).not.toBe(false);
  await fireEvent(screen.getByTestId("discovery-map"), "mapInteraction");
  const location = recentFix();
  await act(async () => finishLocation(location));
  await waitFor(() =>
    expect(screen.getByTestId("map-controls").props.isLocating).toBe(false),
  );
  expect(client.getQueryData(USER_LOCATION_QUERY_KEY)).toMatchObject({
    status: "available",
    location,
  });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).not.toHaveBeenCalled();
});

it("allows manual exploration while the first passive location is pending", async () => {
  let finishLocation!: (location: LocationObject) => void;
  jest.mocked(Location.getCurrentPositionAsync).mockReturnValueOnce(
    new Promise((resolve) => {
      finishLocation = resolve;
    }),
  );
  const { screen, camera } = await setupSharedLocation();
  await waitFor(() =>
    expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1),
  );
  expect(screen.getByTestId("map-controls").props.isLocating).toBe(true);
  expect(screen.getByTestId("discovery-map").props.businesses).toHaveLength(1);
  await fireEvent(screen.getByTestId("discovery-map"), "mapInteraction");
  await act(async () => finishLocation(recentFix()));
  await waitFor(() =>
    expect(screen.getByTestId("map-controls").props.isLocating).toBe(false),
  );
  expect(camera.animateToRegion).not.toHaveBeenCalled();
});

it("offers Settings after explicit denial and revalidates on foreground return without recentering", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
  const { screen, camera } = await setupSharedLocation(cachedLocationClient());
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  camera.animateToRegion.mockClear();
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: "denied",
  } as never);
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
  const settingsAction = alert.mock.calls[0][2]!.find(
    (button) => button.text === "Open Settings",
  )!;
  await act(() => settingsAction.onPress?.());
  expect(openSettings).toHaveBeenCalledTimes(1);

  await changeAppState("background");
  jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
    status: "granted",
  } as never);
  await changeAppState("active");
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).not.toHaveBeenCalled();
});

it("offers a fresh retry after temporary location failure", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const { screen, camera } = await setupSharedLocation(cachedLocationClient());
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  camera.animateToRegion.mockClear();
  jest.mocked(Location.getCurrentPositionAsync).mockRejectedValueOnce(
    new Error("Location services unavailable"),
  );
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
  const retryAction = alert.mock.calls[0][2]!.find(
    (button) => button.text === "Try Again",
  )!;
  await act(() => retryAction.onPress?.());
  await waitFor(() => expect(camera.animateToRegion).toHaveBeenCalledTimes(1));
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(2);
});

it("does not apply passive permission revocation or recovery to the camera", async () => {
  const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  const { screen, camera } = await setupSharedLocation(cachedLocationClient());
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  camera.animateToRegion.mockClear();
  await changeAppState("background");
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    status: "denied",
  } as never);
  await changeAppState("active");
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.userLocation).toBeNull(),
  );
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  await changeAppState("background");
  jest.mocked(Location.getForegroundPermissionsAsync).mockResolvedValue({
    status: "granted",
  } as never);
  await changeAppState("active");
  await waitFor(() =>
    expect(screen.getByTestId("discovery-map").props.showsUserLocation).toBe(true),
  );
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledTimes(1);
  expect(camera.animateToRegion).not.toHaveBeenCalled();
  expect(alert).not.toHaveBeenCalled();
});

it.each(["success", "failure"])(
  "keeps a delayed Locate Me %s stale after backgrounding and returning",
  async (outcome) => {
    const alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const request = deferredLocation();
    const { screen, camera } = await setupLocateMe(
      jest.fn(() => request.promise),
    );
    await fireEvent(screen.getByTestId("map-controls"), "locateMe");
    await changeAppState("background");
    await changeAppState("active");
    await act(async () => {
      if (outcome === "success") {
        request.resolve(availableLocation);
      } else {
        request.resolve(deniedLocation);
      }
      await request.promise;
    });
    expect(camera.animateToRegion).not.toHaveBeenCalled();
    expect(alert).not.toHaveBeenCalled();
  },
);

it("preserves explicit Locate Me through a temporary inactive permission dialog", async () => {
  const request = deferredLocation();
  const { screen, camera } = await setupLocateMe(
    jest.fn(() => request.promise),
  );
  await fireEvent(screen.getByTestId("map-controls"), "locateMe");
  await changeAppState("inactive");
  await changeAppState("active");
  await act(async () => {
    request.resolve(availableLocation);
    await request.promise;
  });
  expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
});
