import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

const mockRedrawMarker = jest.fn();

const mockMap = {
  animateCamera: jest.fn(),
  getCamera: jest.fn().mockResolvedValue({ zoom: 12 }),
  getMapBoundaries: jest.fn().mockResolvedValue(undefined),
  fitToCoordinates: jest.fn(),
};

const denseRegion = {
  latitude: 10.3157,
  longitude: 123.8854,
  latitudeDelta: 0.0006,
  longitudeDelta: 0.0006,
};

function denseBusinesses(offset: number) {
  return [1, 2, 3, 4, 5, 6].map((id) => ({
    id,
    latitude: denseRegion.latitude + ((id - 1) % 3) * offset,
    longitude:
      denseRegion.longitude +
      (id <= 3 ? -0.0003 : 0.0003) +
      ((id - 1) % 3) * offset,
    is_hidden_gem: id === 1 || id === 4,
  }));
}

// Exercise the installed clustering wrapper and its real callback-ref contract.
// Use Supercluster's shipped CommonJS build in Jest instead of its ESM entry.
jest.mock("supercluster", () => {
  const { createRequire } = jest.requireActual("node:module");
  const { resolve } = jest.requireActual("node:path");
  const entry = createRequire(resolve("package.json")).resolve("supercluster");
  return jest.requireActual(entry.replace("index.js", "dist/supercluster.js"));
});
jest.mock("react-native-maps", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: React.forwardRef(function NativeMap(props: object, ref: unknown) {
      React.useImperativeHandle(ref, () => mockMap);
      return <View testID="native-map" {...props} />;
    }),
    Marker: React.forwardRef(function NativeMarker(
      props: { identifier?: string },
      ref: unknown,
    ) {
      const identifier = props.identifier ?? "cluster";
      React.useImperativeHandle(
        ref,
        () => ({ redraw: () => mockRedrawMarker(identifier) }),
        [identifier],
      );
      return <View testID="native-marker" {...props} />;
    }),
    Polyline: View,
    PROVIDER_GOOGLE: "google",
  };
});
jest.mock("@/shared/components/MapMarker", () => {
  const { View } = jest.requireActual("react-native");
  return function SharedMarker() {
    return <View />;
  };
});

it.each([
  { label: "identical", offset: 0 },
  { label: "near-identical", offset: 0.00000001 },
])(
  "keeps every business selectable when two $label-coordinate clusters expand",
  async ({ offset }) => {
    const businesses = denseBusinesses(offset);
    const onBusinessPress = jest.fn();
    const screen = await render(
      <BusinessDiscoveryMap
        businesses={businesses}
        userLocation={null}
        autoCenterOnLocation={false}
        onBusinessPress={onBusinessPress}
      />,
    );
    await fireEvent.press(screen.getByLabelText(/6 businesses, including 2 hidden gems/));
    expect(mockMap.fitToCoordinates).toHaveBeenCalledWith(
      businesses.map(({ latitude, longitude }) => ({ latitude, longitude })),
      expect.anything(),
    );
    await fireEvent(
      screen.getByTestId("native-map"),
      "regionChangeComplete",
      denseRegion,
    );
    const markers = screen.getAllByTestId("native-marker");
    expect(markers.map((marker) => marker.props.identifier).sort()).toEqual([
      "1", "2", "3", "4", "5", "6",
    ]);
    for (const business of businesses) {
      const marker = markers.find(
        (item) => item.props.identifier === String(business.id),
      )!;
      // Identity and cluster origin survive native marker cloning.
      expect(marker.props.coordinate.centerPoint.longitude).toBeCloseTo(
        denseRegion.longitude + (business.id <= 3 ? -0.0003 : 0.0003),
        5,
      );
      await fireEvent.press(marker);
      expect(onBusinessPress).toHaveBeenLastCalledWith(business.id);
    }
    for (const ids of [["1", "2", "3"], ["4", "5", "6"]]) {
      const coordinates = markers
        .filter((marker) => ids.includes(marker.props.identifier))
        .map(({ props }) => JSON.stringify([
          props.coordinate.latitude,
          props.coordinate.longitude,
        ]));
      expect(new Set(coordinates).size).toBe(3);
    }
  },
);

it("preserves selected identity and remaining cluster membership across dense selection changes", async () => {
  const businesses = denseBusinesses(0);
  const props = {
    businesses,
    userLocation: null,
    autoCenterOnLocation: false,
    dimUnselectedMarkers: true,
  };
  const screen = await render(<BusinessDiscoveryMap {...props} />);
  await fireEvent.press(screen.getByLabelText(/6 businesses/));
  await fireEvent(
    screen.getByTestId("native-map"),
    "regionChangeComplete",
    denseRegion,
  );
  for (const selectedId of [1, 4]) {
    await screen.rerender(
      <BusinessDiscoveryMap {...props} selectedBusinessId={selectedId} />,
    );
    const markers = screen.getAllByTestId("native-marker");
    expect(markers.map(({ props }) => props.identifier).sort()).toEqual([
      "1", "2", "3", "4", "5", "6",
    ]);
    const selected = markers.find(
      ({ props }) => props.identifier === String(selectedId),
    )!;
    const business = businesses.find(({ id }) => id === selectedId)!;
    expect(selected.props.coordinate).toEqual({
      latitude: business.latitude,
      longitude: business.longitude,
    });
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(selected.props.zIndex).toBe(3);
    expect(selected.props.opacity).toBe(1);
    for (const marker of markers.filter((item) => item !== selected)) {
      expect(marker.props.opacity).toBe(0.55);
      const id = Number(marker.props.identifier);
      if ((id <= 3) !== (selectedId <= 3)) {
        // Only the other three-member cluster is expanded. The selected
        // business's two neighbors are ordinary markers, not duplicate leaves.
        expect(marker.props.coordinate.centerPoint).toBeDefined();
      } else {
        expect(marker.props.coordinate.centerPoint).toBeUndefined();
      }
    }
  }
  await screen.rerender(<BusinessDiscoveryMap {...props} />);
  const expanded = screen.getAllByTestId("native-marker");
  expect(expanded.map(({ props }) => props.identifier).sort()).toEqual([
    "1", "2", "3", "4", "5", "6",
  ]);
  expect(expanded.every(({ props }) => props.opacity === 1)).toBe(true);

  await fireEvent(
    screen.getByTestId("native-map"),
    "regionChangeComplete",
    { ...denseRegion, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  );
  expect(screen.getAllByTestId("native-marker")).toHaveLength(1);
  const cluster = screen.getByLabelText(/6 businesses, including 2 hidden gems/);
  await fireEvent.press(cluster);
  expect(mockMap.fitToCoordinates).toHaveBeenLastCalledWith(
    businesses.map(({ latitude, longitude }) => ({ latitude, longitude })),
    expect.anything(),
  );
});

it("dispatches search focus through the installed clustering ref and keeps the selected business outside clusters", async () => {
  const target = { latitude: 10.3157, longitude: 123.8854 };
  const onBusinessPress = jest.fn();
  const onMapInteraction = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[
        { id: 1, ...target },
        { id: 2, ...target },
        { id: 3, ...target },
        { id: 4, ...target },
      ]}
      selectedBusinessId={1}
      onBusinessPress={onBusinessPress}
      onMapInteraction={onMapInteraction}
      focusTarget={target}
      userLocation={null}
      autoCenterOnLocation={false}
    />,
  );
  const map = screen.getByTestId("native-map");
  await fireEvent(map, "layout", { nativeEvent: { layout: { height: 800 } } });
  await fireEvent(map, "mapReady");
  await waitFor(() =>
    expect(mockMap.animateCamera).toHaveBeenCalledWith(
      { center: target, zoom: 16 },
      { duration: 500 },
    ),
  );
  const markers = screen.getAllByTestId("native-marker");
  expect(markers).toHaveLength(2); // One cluster plus the selected marker.
  const selectedMarker = markers.find(
    (marker) => marker.props.identifier === "1",
  )!;
  const cluster = screen.getByLabelText(/3 businesses/);
  expect(selectedMarker.props.coordinate).toEqual(target);
  expect(selectedMarker.props.accessibilityState.selected).toBe(true);
  expect(selectedMarker.props.zIndex).toBeGreaterThan(cluster.props.zIndex);
  await fireEvent.press(selectedMarker);
  expect(onBusinessPress).toHaveBeenCalledTimes(1);
  expect(onBusinessPress).toHaveBeenCalledWith(1);
  await fireEvent.press(cluster);
  expect(mockMap.fitToCoordinates).toHaveBeenCalledWith(
    [target, target, target],
    expect.anything(),
  );
  expect(onMapInteraction).toHaveBeenCalledTimes(1);
  expect(mockMap.animateCamera).toHaveBeenCalledTimes(1);
});

it.each([null, 1])(
  "redraws visible clusters and businesses on repeated focus without moving the camera (selected: %s)",
  async (selectedBusinessId) => {
    const target = { latitude: 10.3157, longitude: 123.8854 };
    const businesses = [
      ...[1, 2, 3, 4].map((id) => ({ id, ...target })),
      {
        id: 5,
        latitude: target.latitude + 0.03,
        longitude: target.longitude + 0.03,
      },
    ];
    const props = {
      businesses,
      selectedBusinessId,
      userLocation: null,
      autoCenterOnLocation: false,
    };
    const screen = await render(
      <BusinessDiscoveryMap {...props} isScreenFocused />,
    );
    const map = () => screen.getByTestId("native-map");
    await fireEvent(map(), "mapReady");
    await waitFor(() =>
      expect(mockRedrawMarker).toHaveBeenCalledWith("cluster"),
    );
    const markerCount = screen.getAllByTestId("native-marker").length;
    for (let visit = 0; visit < 2; visit += 1) {
      await screen.rerender(
        <BusinessDiscoveryMap {...props} isScreenFocused={false} />,
      );
      mockRedrawMarker.mockClear();
      await screen.rerender(
        <BusinessDiscoveryMap {...props} isScreenFocused />,
      );
      await waitFor(() =>
        expect(mockRedrawMarker).toHaveBeenCalledWith("cluster"),
      );
      expect(mockRedrawMarker).toHaveBeenCalledWith("5");
      if (selectedBusinessId !== null)
        expect(mockRedrawMarker).toHaveBeenCalledWith(
          String(selectedBusinessId),
        );
      expect(screen.getAllByTestId("native-marker")).toHaveLength(markerCount);
      expect(mockMap.animateCamera).not.toHaveBeenCalled();
      expect(mockMap.getCamera).not.toHaveBeenCalled();
    }
  },
);
