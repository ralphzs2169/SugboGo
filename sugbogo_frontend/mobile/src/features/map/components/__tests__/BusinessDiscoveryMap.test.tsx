import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { LocationObject } from "expo-location";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

const mockNativeMap = {
  animateToRegion: jest.fn(),
  getMapBoundaries: jest.fn(),
};

jest.mock("react-native-map-clustering", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return React.forwardRef(function MockClusteredMap(
    props: object,
    ref: unknown,
  ) {
    React.useImperativeHandle(ref, () => mockNativeMap);
    return <View testID="clustered-map" {...props} />;
  });
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
