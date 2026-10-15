import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

import useUserLocation from "@/shared/hooks/useUserLocation";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { getMapDiscoveryBusinesses } from "../../api/mapDiscovery.service";
import MapScreen from "../MapScreen";
import { router, useNavigation } from "expo-router";

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
jest.mock("../../components/MapSearchOverlay", () => () => null);
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
    expect(screen.getByText(/No businesses in the searched area/)).toBeTruthy(),
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
