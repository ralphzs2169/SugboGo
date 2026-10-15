import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

const mockRedrawMarker = jest.fn();

const mockMap = {
  animateCamera: jest.fn(),
  getCamera: jest.fn().mockResolvedValue({ zoom: 12 }),
  getMapBoundaries: jest.fn().mockResolvedValue(undefined),
};

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

it("dispatches search focus through the installed clustering ref and keeps the selected business outside clusters", async () => {
  const target = { latitude: 10.3157, longitude: 123.8854 };
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={[
        { id: 1, ...target },
        { id: 2, ...target },
        { id: 3, ...target },
        { id: 4, ...target },
      ]}
      selectedBusinessId={1}
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
  expect(
    markers.find((marker) => marker.props.identifier === "1")?.props.cluster,
  ).toBe(false);
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
