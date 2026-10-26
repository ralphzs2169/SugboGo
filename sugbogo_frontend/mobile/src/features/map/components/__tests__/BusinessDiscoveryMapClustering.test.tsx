import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { LatLng } from "react-native-maps";

import BusinessDiscoveryMap from "../BusinessDiscoveryMap";

const mockRedrawMarker = jest.fn();
const mockPresentChoices = jest.fn();
const mockDismissChoices = jest.fn();

const mockMap = {
  animateCamera: jest.fn(),
  getCamera: jest.fn().mockResolvedValue({ zoom: 12 }),
  getMapBoundaries: jest.fn().mockResolvedValue(undefined),
  fitToCoordinates: jest.fn(),
  pointForCoordinate: jest.fn(async (coordinate: LatLng) => ({
    x: (coordinate.longitude - denseRegion.longitude) * 1_000_000,
    y: (coordinate.latitude - denseRegion.latitude) * 1_000_000,
  })),
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
      const currentProps = React.useRef(props);
      currentProps.current = props;
      React.useImperativeHandle(
        ref,
        () => ({
          redraw: () => mockRedrawMarker(identifier),
          get props() {
            return currentProps.current;
          },
        }),
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

// Keep the shared sheet at its selection boundary; native modal animation is
// independent of whether an obscured business has a named, reachable action.
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text, View } = jest.requireActual("react-native");
  return function SelectionSheet({
    sheetRef,
    options,
    onSelect,
  }: {
    sheetRef: object;
    options: { label: string; value: string }[];
    onSelect: (value: string) => void;
  }) {
    React.useImperativeHandle(sheetRef, () => ({
      present: mockPresentChoices,
      dismiss: mockDismissChoices,
    }));
    return (
      <View testID="overlap-choices" onSelect={onSelect}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  };
});

it.each([
  { label: "exact", offset: 0 },
  { label: "effectively coincident", offset: 0.00000001 },
  { label: "visually overlapping", offset: 0.00003 },
])(
  "offers both $label businesses when the covering marker is tapped",
  async ({ offset }) => {
    const businesses = [
      {
        id: 71,
        business_name: "First Cafe",
        latitude: denseRegion.latitude,
        longitude: denseRegion.longitude,
      },
      {
        id: 93,
        business_name: "Second Cafe",
        latitude: denseRegion.latitude + offset,
        longitude: denseRegion.longitude + offset,
        is_hidden_gem: true,
      },
    ];
    const onBusinessPress = jest.fn();
    const screen = await render(
      <BusinessDiscoveryMap
        businesses={businesses}
        userLocation={null}
        autoCenterOnLocation={false}
        onBusinessPress={onBusinessPress}
      />,
    );
    const markers = screen.getAllByTestId("native-marker");
    expect(markers).toHaveLength(2);
    // No cluster/spiral exists to separate these two ordinary markers.
    expect(
      Math.abs(
        markers[0].props.coordinate.latitude -
          markers[1].props.coordinate.latitude,
      ) * 1_000_000,
    ).toBeLessThan(48);
    await fireEvent.press(markers[1]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "First Cafe" })).toBeTruthy(),
    );
    expect(onBusinessPress).not.toHaveBeenCalled();
    expect(mockPresentChoices).toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "First Cafe" }));
    expect(onBusinessPress).toHaveBeenLastCalledWith(71);
    expect(mockDismissChoices).toHaveBeenCalled();
    await fireEvent.press(markers[1]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Second Cafe" })).toBeTruthy(),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Second Cafe" }));
    expect(onBusinessPress).toHaveBeenLastCalledWith(93);
    expect(mockMap.fitToCoordinates).not.toHaveBeenCalled();
  },
);

it("returns a nearby pair to direct selection when zoom separates its pins", async () => {
  const businesses = [
    {
      id: 5,
      business_name: "First Cafe",
      latitude: denseRegion.latitude,
      longitude: denseRegion.longitude,
    },
    {
      id: 9,
      business_name: "Second Cafe",
      latitude: denseRegion.latitude + 0.00003,
      longitude: denseRegion.longitude,
    },
  ];
  const onBusinessPress = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      autoCenterOnLocation={false}
      onBusinessPress={onBusinessPress}
    />,
  );
  await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Second Cafe" })).toBeTruthy(),
  );
  await fireEvent(
    screen.getByTestId("native-map"),
    "regionChangeComplete",
    denseRegion,
  );
  expect(screen.queryByTestId("overlap-choices")).toBeNull();
  // The native projection now places the same coordinates 90 points apart.
  mockMap.pointForCoordinate
    .mockResolvedValueOnce({ x: 0, y: 0 })
    .mockResolvedValueOnce({ x: 0, y: 90 });
  await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
  await waitFor(() => expect(onBusinessPress).toHaveBeenCalledWith(5));
  expect(screen.queryByTestId("overlap-choices")).toBeNull();
  await fireEvent(
    screen.getByTestId("native-map"),
    "regionChangeComplete",
    { ...denseRegion, latitudeDelta: 0.08, longitudeDelta: 0.08 },
  );
  await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Second Cafe" })).toBeTruthy(),
  );
});

it("keeps an ordinary separated pair at its locations with direct ID-based selection", async () => {
  const businesses = [
    {
      id: 41,
      latitude: denseRegion.latitude,
      longitude: denseRegion.longitude,
    },
    {
      id: 52,
      latitude: denseRegion.latitude + 0.0001,
      longitude: denseRegion.longitude,
      is_hidden_gem: true,
    },
  ];
  const onBusinessPress = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      userLocation={null}
      autoCenterOnLocation={false}
      onBusinessPress={onBusinessPress}
    />,
  );
  const markers = screen.getAllByTestId("native-marker");
  expect(markers).toHaveLength(2);
  for (const business of businesses) {
    const marker = markers.find(
      ({ props }) => props.identifier === String(business.id),
    )!;
    expect(marker.props.coordinate).toEqual({
      latitude: business.latitude,
      longitude: business.longitude,
    });
    await fireEvent.press(marker);
    await waitFor(() =>
      expect(onBusinessPress).toHaveBeenLastCalledWith(business.id),
    );
    expect(screen.queryByTestId("overlap-choices")).toBeNull();
  }
});

it("selects the tapped ID on projection failure and retries disambiguation on a later tap", async () => {
  const businesses = [5, 9].map((id) => ({
    id,
    business_name: `Business ${id}`,
    latitude: denseRegion.latitude,
    longitude: denseRegion.longitude,
  }));
  const onBusinessPress = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      selectedBusinessId={5}
      userLocation={null}
      autoCenterOnLocation={false}
      onBusinessPress={onBusinessPress}
    />,
  );
  mockMap.pointForCoordinate.mockRejectedValueOnce(
    new Error("Map reattaching"),
  );
  const selected = screen
    .getAllByTestId("native-marker")
    .find(({ props }) => props.identifier === "5")!;
  await fireEvent.press(selected);
  await waitFor(() => expect(onBusinessPress).toHaveBeenCalledWith(5));
  expect(screen.queryByTestId("overlap-choices")).toBeNull();
  await fireEvent.press(selected);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Business 9" })).toBeTruthy(),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Business 9" }));
  expect(onBusinessPress).toHaveBeenCalledWith(9);
});

it.each(["movement", "filter change", "blur", "unmount", "newer press"])(
  "discards a pending overlap lookup after %s",
  async (change) => {
    const businesses = [5, 9].map((id) => ({
      id,
      business_name: `Business ${id}`,
      latitude: denseRegion.latitude,
      longitude: denseRegion.longitude,
    }));
    const onBusinessPress = jest.fn();
    const props = {
      businesses,
      onBusinessPress,
      userLocation: null,
      autoCenterOnLocation: false,
      isScreenFocused: true,
    };
    const screen = await render(<BusinessDiscoveryMap {...props} />);
    let finish!: (point: { x: number; y: number }) => void;
    mockMap.pointForCoordinate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
    await waitFor(() => expect(finish).toBeDefined());
    if (change === "movement") {
      await fireEvent(
        screen.getByTestId("native-map"),
        "regionChange",
        denseRegion,
        { isGesture: true },
      );
    } else if (change === "filter change") {
      await screen.rerender(
        <BusinessDiscoveryMap {...props} businesses={businesses.slice(0, 1)} />,
      );
    } else if (change === "unmount") {
      await screen.unmount();
    } else if (change === "newer press") {
      await fireEvent.press(screen.getAllByTestId("native-marker")[1]);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Business 5" })).toBeTruthy(),
      );
      await fireEvent.press(screen.getByRole("button", { name: "Business 9" }));
    } else {
      await screen.rerender(
        <BusinessDiscoveryMap {...props} isScreenFocused={false} />,
      );
    }
    await act(async () => finish({ x: 0, y: 0 }));
    if (change !== "unmount") {
      expect(screen.queryByTestId("overlap-choices")).toBeNull();
    }
    if (change === "newer press") {
      expect(onBusinessPress).toHaveBeenCalledTimes(1);
      expect(onBusinessPress).toHaveBeenCalledWith(9);
    } else {
      expect(onBusinessPress).not.toHaveBeenCalled();
    }
  },
);

it("accepts one chooser action when two options are pressed synchronously", async () => {
  const businesses = [5, 9].map((id) => ({
    id,
    business_name: `Business ${id}`,
    latitude: denseRegion.latitude,
    longitude: denseRegion.longitude,
  }));
  const onBusinessPress = jest.fn();
  const screen = await render(
    <BusinessDiscoveryMap
      businesses={businesses}
      onBusinessPress={onBusinessPress}
      userLocation={null}
      autoCenterOnLocation={false}
    />,
  );
  await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Business 9" })).toBeTruthy(),
  );
  const choose = screen.getByTestId("overlap-choices").props.onSelect;
  await act(() => {
    choose("9");
    choose("5");
  });
  expect(onBusinessPress).toHaveBeenCalledTimes(1);
  expect(onBusinessPress).toHaveBeenCalledWith(9);
});

it("drops overlap choices after filtering and directly selects the remaining business", async () => {
  const businesses = [5, 9].map((id) => ({
    id,
    business_name: `Business ${id}`,
    latitude: denseRegion.latitude,
    longitude: denseRegion.longitude,
  }));
  const onBusinessPress = jest.fn();
  const props = {
    businesses,
    onBusinessPress,
    userLocation: null,
    autoCenterOnLocation: false,
  };
  const screen = await render(<BusinessDiscoveryMap {...props} />);
  await fireEvent.press(screen.getAllByTestId("native-marker")[0]);
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Business 9" })).toBeTruthy(),
  );
  const staleSelect = screen.getByTestId("overlap-choices").props.onSelect;
  await screen.rerender(
    <BusinessDiscoveryMap {...props} businesses={businesses.slice(0, 1)} />,
  );
  expect(screen.queryByTestId("overlap-choices")).toBeNull();
  await act(() => staleSelect("9"));
  expect(onBusinessPress).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByTestId("native-marker"));
  expect(onBusinessPress).toHaveBeenCalledWith(5);
});

it("keeps residual neighbors reachable through A → B → C selection and reclustering", async () => {
  const businesses = [11, 22, 33].map((id) => ({
    id,
    business_name: `Business ${id}`,
    latitude: denseRegion.latitude,
    longitude: denseRegion.longitude,
    is_hidden_gem: id === 11,
  }));
  const onBusinessPress = jest.fn();
  const props = {
    businesses,
    userLocation: null,
    autoCenterOnLocation: false,
    dimUnselectedMarkers: true,
    onBusinessPress,
  };
  const screen = await render(<BusinessDiscoveryMap {...props} />);
  expect(
    screen.getByLabelText(/3 businesses, including 1 hidden gem/),
  ).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/3 businesses/));
  await fireEvent(
    screen.getByTestId("native-map"),
    "regionChangeComplete",
    denseRegion,
  );
  for (const [selectedId, nextId] of [
    [11, 22],
    [22, 33],
    [33, 11],
  ]) {
    await screen.rerender(
      <BusinessDiscoveryMap {...props} selectedBusinessId={selectedId} />,
    );
    const markers = screen.getAllByTestId("native-marker");
    expect(markers.map(({ props }) => props.identifier).sort()).toEqual([
      "11",
      "22",
      "33",
    ]);
    const selected = markers.find(
      ({ props }) => props.identifier === String(selectedId),
    )!;
    expect(selected.props.accessibilityState.selected).toBe(true);
    expect(selected.props.zIndex).toBeGreaterThan(
      markers.find((marker) => marker !== selected)!.props.zIndex,
    );
    // Press the topmost pin, rather than invoking an obscured pin's handler.
    await fireEvent.press(selected);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: `Business ${nextId}` }),
      ).toBeTruthy(),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: `Business ${nextId}` }),
    );
    expect(onBusinessPress).toHaveBeenLastCalledWith(nextId);
  }
  await screen.rerender(<BusinessDiscoveryMap {...props} />);
  await fireEvent(screen.getByTestId("native-map"), "regionChangeComplete", {
    ...denseRegion,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  expect(screen.getAllByTestId("native-marker")).toHaveLength(1);
  expect(
    screen.getByLabelText(/3 businesses, including 1 hidden gem/),
  ).toBeTruthy();
  expect(screen.queryByTestId("overlap-choices")).toBeNull();
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
    await fireEvent.press(
      screen.getByLabelText(/6 businesses, including 2 hidden gems/),
    );
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
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
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
      expect(screen.queryByTestId("overlap-choices")).toBeNull();
    }
    for (const ids of [
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]) {
      const coordinates = markers
        .filter((marker) => ids.includes(marker.props.identifier))
        .map(({ props }) =>
          JSON.stringify([
            props.coordinate.latitude,
            props.coordinate.longitude,
          ]),
        );
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
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
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
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
  ]);
  expect(expanded.every(({ props }) => props.opacity === 1)).toBe(true);

  await fireEvent(screen.getByTestId("native-map"), "regionChangeComplete", {
    ...denseRegion,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });
  expect(screen.getAllByTestId("native-marker")).toHaveLength(1);
  const cluster = screen.getByLabelText(
    /6 businesses, including 2 hidden gems/,
  );
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
