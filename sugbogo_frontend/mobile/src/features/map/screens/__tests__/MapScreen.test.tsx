import React from "react";
import type { LocationObject } from "expo-location";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { Alert, AppState } from "react-native";

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

beforeEach(() => {
  mockScreenFocused = true;
  AppState.currentState = "active";
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
  "ignores an older Locate Me $outcome after a newer Locate Me completes",
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
    expect(refreshLocation).toHaveBeenCalledTimes(2);
    await act(async () => {
      newerRequest.resolve(availableLocation);
      await newerRequest.promise;
    });
    expect(camera.animateToRegion).toHaveBeenCalledTimes(1);
    const latestCameraCall = camera.animateToRegion.mock.calls[0];
    await act(async () => {
      olderRequest.resolve(result);
      await olderRequest.promise;
    });

    expect(camera.animateToRegion.mock.calls).toEqual([latestCameraCall]);
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
