import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { LocationObject } from "expo-location";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => () => null);

const mockNativeMap = {
  animateToRegion: jest.fn(),
  animateCamera: jest.fn(),
  getCamera: jest.fn().mockResolvedValue({ zoom: 12 }),
  getMapBoundaries: jest.fn(),
  pointForCoordinate: jest.fn(),
  coordinateForPoint: jest.fn(),
};

jest.mock("react-native-map-clustering", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return React.forwardRef(function MockClusteredMap(
    props: { mapRef: (map: unknown) => void },
    ref: unknown,
  ) {
    const { mapRef } = props;
    React.useLayoutEffect(() => {
      mapRef(mockNativeMap);
    }, [mapRef]);
    return <View testID="clustered-map" {...props} />;
  });
});

it("queues search focus until native readiness and layout, then uses the camera API once", async () => {
  const target = { latitude: 10.8, longitude: 123.8 };
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      focusTarget={target}
      previewBottomInset={260}
    />,
  );
  const map = () => screen.getByTestId("clustered-map");
  expect(mockNativeMap.animateCamera).not.toHaveBeenCalled();
  await fireEvent(map(), "mapReady");
  expect(mockNativeMap.animateCamera).not.toHaveBeenCalled();
  await fireEvent(map(), "layout", {
    nativeEvent: { layout: { height: 800 } },
  });
  await waitFor(() =>
    expect(mockNativeMap.animateCamera).toHaveBeenCalledWith(
      { center: target, zoom: 16 },
      { duration: 500 },
    ),
  );
  expect(map().props.mapPadding.bottom).toBe(260);
  const padding = map().props.mapPadding;
  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={[{ id: 1, ...target }]}
      userLocation={null}
      autoCenterOnLocation={false}
      focusTarget={target}
      previewBottomInset={260}
      selectedBusinessId={1}
    />,
  );
  await fireEvent(map(), "layout", {
    nativeEvent: { layout: { height: 760 } },
  });
  // Flush a native frame so a replay scheduled by the layout effect would run.
  await act(async () => {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  });
  expect(map().props.mapPadding).toBe(padding);
  expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
});

it("distinguishes native gestures from programmatic region changes", async () => {
  const onMapInteraction = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      onMapInteraction={onMapInteraction}
    />,
  );
  const map = screen.getByTestId("clustered-map");
  await fireEvent(map, "regionChange", region, { isGesture: false });
  expect(onMapInteraction).not.toHaveBeenCalled();
  await fireEvent(map, "regionChange", region, { isGesture: true });
  expect(onMapInteraction).toHaveBeenCalledTimes(1);
});

it("centers ordinary marker selections once without changing zoom or orientation", async () => {
  const target = { latitude: 10.3, longitude: 123.9, preserveZoom: true };
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      manageMarkerCamera
      focusTarget={target}
      previewBottomInset={260}
    />,
  );
  const map = screen.getByTestId("clustered-map");
  expect(map.props.moveOnMarkerPress).toBe(false);
  await fireEvent(map, "layout", { nativeEvent: { layout: { height: 800 } } });
  await fireEvent(map, "mapReady");
  await waitFor(() =>
    expect(mockNativeMap.animateCamera).toHaveBeenCalledWith(
      { center: { latitude: 10.3, longitude: 123.9 } },
      { duration: 500 },
    ),
  );
  expect(mockNativeMap.getCamera).not.toHaveBeenCalled();
  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      manageMarkerCamera
      focusTarget={null}
      previewBottomInset={260}
    />,
  );
  expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
});

it.each([12, 16, 18])(
  "only zooms search selections in when needed from zoom %s",
  async (zoom) => {
    mockNativeMap.getCamera.mockResolvedValueOnce({ zoom });
    const target = { latitude: 10.3, longitude: 123.9 };
    const screen = await render(
      <BusinessDiscoveryMap
        businesses={[]}
        userLocation={null}
        autoCenterOnLocation={false}
        focusTarget={target}
      />,
    );
    await fireEvent(screen.getByTestId("clustered-map"), "layout", {
      nativeEvent: { layout: { height: 800 } },
    });
    await fireEvent(screen.getByTestId("clustered-map"), "mapReady");
    await waitFor(() =>
      expect(mockNativeMap.animateCamera).toHaveBeenCalledWith(
        { center: target, ...(zoom < 16 && { zoom: 16 }) },
        { duration: 500 },
      ),
    );
    expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
  },
);

it("discards an older pending search camera read after a newer selection", async () => {
  let finishOld: (camera: { zoom: number }) => void = () => {};
  mockNativeMap.getCamera.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishOld = resolve;
      }),
  );
  const target = { latitude: 10.3, longitude: 123.9 };
  const next = { latitude: 10.4, longitude: 124 };
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      focusTarget={target}
    />,
  );
  await fireEvent(screen.getByTestId("clustered-map"), "layout", {
    nativeEvent: { layout: { height: 800 } },
  });
  await fireEvent(screen.getByTestId("clustered-map"), "mapReady");
  await waitFor(() => expect(mockNativeMap.getCamera).toHaveBeenCalledTimes(1));
  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      focusTarget={next}
    />,
  );
  await waitFor(() =>
    expect(mockNativeMap.animateCamera).toHaveBeenCalledWith(
      { center: next, zoom: 16 },
      { duration: 500 },
    ),
  );
  await act(async () => finishOld({ zoom: 10 }));
  expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
});
jest.mock("react-native-maps", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: View,
    Marker: (props: object) => <View testID="business-marker" {...props} />,
    PROVIDER_GOOGLE: "google",
  };
});
jest.mock("@/shared/components/MapMarker", () => {
  const { View } = jest.requireActual("react-native");
  return function MockMapMarker(props: object) {
    return <View testID="shared-marker" {...props} />;
  };
});

const location = {
  coords: { latitude: 10.3, longitude: 123.9 },
} as LocationObject;
const region = {
  latitude: 10.3,
  longitude: 123.9,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

it("preserves the read-only Explore preview and shared standard markers", async () => {
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[{ id: 42, latitude: 10.31, longitude: 123.91 }]}
      userLocation={location}
      interactive={false}
      trackMarkerUpdates
    />,
  );
  const map = screen.getByTestId("clustered-map");
  expect(map.props.pointerEvents).toBe("none");
  expect(map.props.scrollEnabled).toBe(false);
  expect(map.props.zoomEnabled).toBe(false);
  expect(map.props.showsUserLocation).toBe(true);
  expect(map.props.clusteringEnabled).toBe(true);
  expect(mockNativeMap.animateToRegion).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId("shared-marker").props.variant).toBe("business");
});

it("reads native viewport edges and falls back to region deltas when unavailable", async () => {
  const onViewportChange = jest.fn();
  mockNativeMap.getMapBoundaries.mockResolvedValueOnce({
    northEast: { latitude: 10.4, longitude: 124 },
    southWest: { latitude: 10.2, longitude: 123.8 },
  });
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      autoCenterOnLocation={false}
      onViewportChange={onViewportChange}
    />,
  );
  await fireEvent(
    screen.getByTestId("clustered-map"),
    "regionChangeComplete",
    region,
  );
  await waitFor(() =>
    expect(onViewportChange).toHaveBeenCalledWith({
      north: 10.4,
      south: 10.2,
      east: 124,
      west: 123.8,
    }),
  );
  mockNativeMap.getMapBoundaries.mockRejectedValueOnce(
    new Error("Unavailable"),
  );
  await fireEvent(
    screen.getByTestId("clustered-map"),
    "regionChangeComplete",
    region,
  );
  await waitFor(() => expect(onViewportChange).toHaveBeenCalledTimes(2));
  expect(onViewportChange.mock.calls[1][0].north).toBeCloseTo(10.33);
});

it("discards a native boundary read when a newer camera movement starts", async () => {
  let finishRead: (value: unknown) => void = () => {};
  mockNativeMap.getMapBoundaries.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishRead = resolve;
      }),
  );
  const onViewportChange = jest.fn();
  const onViewportChanging = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[]}
      userLocation={null}
      onViewportChange={onViewportChange}
      onViewportChanging={onViewportChanging}
    />,
  );
  await fireEvent(
    screen.getByTestId("clustered-map"),
    "regionChangeComplete",
    region,
  );
  await fireEvent(screen.getByTestId("clustered-map"), "regionChange", region);
  await act(async () => {
    finishRead(undefined);
  });
  expect(onViewportChange).not.toHaveBeenCalled();
  expect(onViewportChanging).toHaveBeenCalled();
});

it("distinguishes the selected standard marker and keeps selection separate from the camera", async () => {
  const onBusinessPress = jest.fn();
  const businesses = [
    { id: 42, latitude: 10.31, longitude: 123.91 },
    { id: 77, latitude: 10.32, longitude: 123.92, is_hidden_gem: true },
  ];
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      autoCenterOnLocation={false}
      selectedBusinessId={42}
      onBusinessPress={onBusinessPress}
      dimUnselectedMarkers
    />,
  );
  const markers = screen.getAllByTestId("business-marker");
  expect(markers[0].props.accessibilityState.selected).toBe(true);
  expect(markers[1].props.accessibilityState.selected).toBe(false);
  expect(markers.map((marker) => marker.props.opacity)).toEqual([1, 0.55]);
  expect(screen.getAllByTestId("shared-marker")[1].props.variant).toBe(
    "hidden-gem",
  );
  expect(screen.queryByText("Selected")).toBeNull();
  await fireEvent(markers[1], "press");
  expect(onBusinessPress).toHaveBeenCalledWith(77);
  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      autoCenterOnLocation={false}
      selectedBusinessId={77}
      onBusinessPress={onBusinessPress}
      dimUnselectedMarkers
    />,
  );
  expect(
    screen.getAllByTestId("business-marker")[1].props.accessibilityState
      .selected,
  ).toBe(true);
  expect(mockNativeMap.animateToRegion).not.toHaveBeenCalled();
  expect(screen.getByTestId("clustered-map").props.scrollEnabled).toBe(true);
  expect(
    screen
      .getAllByTestId("business-marker")
      .map((marker) => marker.props.opacity),
  ).toEqual([0.55, 1]);
  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      autoCenterOnLocation={false}
      dimUnselectedMarkers
    />,
  );
  expect(
    screen
      .getAllByTestId("business-marker")
      .map((marker) => marker.props.opacity),
  ).toEqual([1, 1]);
});

it("keeps mixed gem and regular markers clusterable and preserves selected gem identity", async () => {
  const businesses = [
    { id: 42, latitude: 10.31, longitude: 123.91, is_hidden_gem: true },
    { id: 77, latitude: 10.32, longitude: 123.92, is_hidden_gem: false },
    { id: 99, latitude: 10.33, longitude: 123.93 },
  ];
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      selectedBusinessId={42}
    />,
  );
  const sharedMarkers = screen.getAllByTestId("shared-marker");
  expect(sharedMarkers.map((marker) => marker.props.variant)).toEqual([
    "hidden-gem",
    "business",
    "business",
  ]);
  expect(screen.queryByText("Selected")).toBeNull();
  const nativeMarkers = screen.getAllByTestId("business-marker");
  expect(nativeMarkers.map((marker) => marker.props.opacity)).toEqual([
    1, 1, 1,
  ]);
  expect(nativeMarkers[0].props.accessibilityState.selected).toBe(true);
  expect(screen.getByTestId("clustered-map").props.clusteringEnabled).toBe(
    true,
  );
  expect(screen.getByTestId("clustered-map").props.scrollEnabled).toBe(true);

  await screen.rerender(
    <BusinessDiscoveryMap
      businesses={[
        { ...businesses[0], is_hidden_gem: false },
        ...businesses.slice(1),
      ]}
      userLocation={null}
      selectedBusinessId={42}
    />,
  );
  expect(screen.getAllByTestId("shared-marker")[0].props.variant).toBe(
    "business",
  );
  expect(screen.queryByText("Selected")).toBeNull();
});

it.each([true, false])(
  "centers in measured overlay bounds once (preserve zoom: %s)",
  async (preserveZoom) => {
    const target = { latitude: 10.3, longitude: 123.9, preserveZoom };
    mockNativeMap.getCamera.mockResolvedValueOnce({
      center: { latitude: 10, longitude: 123 },
      zoom: 15,
      heading: 75,
    });
    mockNativeMap.pointForCoordinate
      .mockResolvedValueOnce({ x: 250, y: 300 })
      .mockResolvedValueOnce({ x: 200, y: 400 });
    mockNativeMap.coordinateForPoint.mockResolvedValueOnce({
      latitude: 10.31,
      longitude: 123.91,
    });
    const props = {
      businesses: [],
      userLocation: null,
      autoCenterOnLocation: false,
      manageMarkerCamera: true,
      focusTarget: target,
    };
    const screen = await render(
      <BusinessDiscoveryMap
        {...props}
        focusInsets={{ top: 100, bottom: 260, ready: false }}
      />,
    );
    const map = () => screen.getByTestId("clustered-map");
    await fireEvent(map(), "layout", {
      nativeEvent: { layout: { width: 400, height: 800 } },
    });
    await fireEvent(map(), "mapReady");
    expect(mockNativeMap.animateCamera).not.toHaveBeenCalled();
    await screen.rerender(
      <BusinessDiscoveryMap
        {...props}
        focusInsets={{ top: 100, bottom: 260, ready: true }}
      />,
    );
    await waitFor(() =>
      expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1),
    );
    // Usable vertical midpoint is (100 + 800 - 260) / 2 = 320.
    expect(mockNativeMap.coordinateForPoint).toHaveBeenCalledWith({
      x: 250,
      y: preserveZoom ? 380 : 340,
    });
    expect(mockNativeMap.animateCamera).toHaveBeenCalledWith(
      {
        center: { latitude: 10.31, longitude: 123.91 },
        ...(!preserveZoom && { zoom: 16 }),
      },
      { duration: 500 },
    );
    const padding = map().props.mapPadding;
    await screen.rerender(
      <BusinessDiscoveryMap
        {...props}
        focusInsets={{ top: 110, bottom: 300, ready: true }}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
    expect(map().props.mapPadding).toBe(padding);
    expect(padding).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    await screen.rerender(
      <BusinessDiscoveryMap
        {...props}
        focusTarget={null}
        focusInsets={{ top: 110, bottom: 0, ready: false }}
      />,
    );
    expect(mockNativeMap.animateCamera).toHaveBeenCalledTimes(1);
  },
);
