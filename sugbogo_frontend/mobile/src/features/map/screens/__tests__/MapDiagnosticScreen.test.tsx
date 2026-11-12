import { act, fireEvent, render } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { Platform, type ViewProps } from "react-native";

import MapDiagnosticRoute from "@/app/(explorer)/map-diagnostic";

const mockMountMap = jest.fn();
const mockUnmountMap = jest.fn();

jest.mock("expo-router", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    Redirect: ({ href }: { href: string }) => (
      <View testID="diagnostic-redirect" accessibilityLabel={href} />
    ),
    Stack: { Screen: () => null },
  };
});

jest.mock("expo-updates", () => ({
  __esModule: true,
  channel: "preview",
  runtimeVersion: "1.0.0",
  updateId: "test-update-id",
  isEmbeddedLaunch: false,
}));

jest.mock("react-native-maps", () => {
  const { useEffect, useRef } = jest.requireActual<typeof import("react")>("react");
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    PROVIDER_GOOGLE: "google",
    default: function MockMap(
      props: ViewProps & { googleMapId?: string },
    ) {
      const initialMapId = useRef(props.googleMapId);

      useEffect(() => {
        const mapId = initialMapId.current;
        mockMountMap(mapId);
        return () => mockUnmountMap(mapId);
      }, []);

      return <View {...props} />;
    },
  };
});

const originalMapId = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID;

beforeEach(() => {
  jest.useFakeTimers();
  jest.replaceProperty(Platform, "OS", "android");
  jest.replaceProperty(Updates, "channel", "preview");
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID = "test-map-id";
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();

  if (originalMapId === undefined) {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID;
  } else {
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID = originalMapId;
  }
});

it.each([
  ["android", "production"],
  ["android", null],
  ["ios", "preview"],
  ["web", "preview"],
] as const)("redirects %s with channel %s to the regular map", async (os, channel) => {
  jest.replaceProperty(Platform, "OS", os);
  jest.replaceProperty(Updates, "channel", channel);

  const screen = await render(<MapDiagnosticRoute />);

  expect(screen.getByTestId("diagnostic-redirect").props.accessibilityLabel)
    .toBe("/(explorer)/(tabs)/map");
  expect(screen.queryByRole("button", { name: "Run Configured" })).toBeNull();
  expect(mockMountMap).not.toHaveBeenCalled();
});

it.each([
  ["Configured", "Default"],
  ["Default", "Configured"],
] as const)("runs %s then %s with a fresh native map", async (first, second) => {
  const screen = await render(<MapDiagnosticRoute />);
  const map = () => screen.getByTestId("diagnostic-map");
  const mapId = (mode: string) => mode === "Configured" ? "test-map-id" : undefined;

  expect(screen.getByText("Downloaded update ID test-update-id")).toBeTruthy();
  expect(screen.getByText("Channel preview · Runtime 1.0.0")).toBeTruthy();
  expect(screen.queryByTestId("diagnostic-map")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: `Run ${first}` }));
  const firstMap = map().props;
  expect(firstMap.googleMapId).toBe(mapId(first));
  expect(mockMountMap).toHaveBeenCalledTimes(1);

  await fireEvent.press(screen.getByRole("button", { name: `Run ${second}` }));
  const secondMap = map().props;
  expect(secondMap.googleMapId).toBe(mapId(second));
  expect(secondMap).toMatchObject({
    initialRegion: firstMap.initialRegion,
    mapType: firstMap.mapType,
    provider: firstMap.provider,
    style: firstMap.style,
  });
  expect(mockUnmountMap).toHaveBeenCalledWith(mapId(first));
  expect(mockMountMap).toHaveBeenNthCalledWith(2, mapId(second));

  await act(() => firstMap.onMapLoaded());
  expect(screen.getByText("Ready Waiting · Loaded Waiting")).toBeTruthy();
  expect(screen.getByText("Ready Not observed · Loaded Not observed")).toBeTruthy();
});

it("records layout, callbacks, the 30-second timeout, and a late load", async () => {
  const screen = await render(<MapDiagnosticRoute />);
  await fireEvent.press(screen.getByRole("button", { name: "Run Default" }));

  const map = () => screen.getByTestId("diagnostic-map");
  await fireEvent(map(), "layout", {
    nativeEvent: { layout: { width: 352, height: 256 } },
  });
  await act(() => {
    jest.advanceTimersByTime(200);
  });
  await fireEvent(map(), "mapReady");
  expect(screen.getByText("Ready 200 ms · Loaded Waiting")).toBeTruthy();

  await act(() => {
    jest.advanceTimersByTime(29_800);
  });
  expect(screen.getByText("Load timeout at 30 s")).toBeTruthy();
  expect(screen.getByText("Ready 200 ms · Loaded Not observed")).toBeTruthy();

  await act(() => {
    jest.advanceTimersByTime(500);
  });
  await fireEvent(map(), "mapLoaded");
  await fireEvent.press(screen.getByRole("button", { name: "Streets visible" }));
  expect(screen.getByText("Ready 200 ms · Loaded 30500 ms")).toBeTruthy();
  expect(screen.getByText("Layout 352 × 256 dp · Streets Visible")).toBeTruthy();

  await fireEvent.press(screen.getByRole("button", { name: "Run Configured" }));
  expect(screen.getByText("Ready 200 ms · Loaded 30500 ms")).toBeTruthy();
  expect(screen.getByText("Load timeout at 30 s")).toBeTruthy();
});

it("keeps the default comparison available when the configured Map ID is empty", async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const screen = await render(<MapDiagnosticRoute />);

  expect(screen.getByRole("button", { name: "Run Configured" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Run Default" }));
  expect(screen.getByTestId("diagnostic-map").props).not.toHaveProperty("googleMapId");
});
