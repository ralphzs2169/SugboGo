import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

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
    Marker: (props: object) => <View testID="native-marker" {...props} />,
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
