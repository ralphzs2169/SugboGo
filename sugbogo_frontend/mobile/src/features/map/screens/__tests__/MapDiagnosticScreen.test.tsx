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
  expect(screen.queryByRole("button", { name: "Run Original" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Run Diagnostic" })).toBeNull();
  expect(mockMountMap).not.toHaveBeenCalled();
});

it.each([
  ["Original", "Default", "Diagnostic"],
  ["Diagnostic", "Default", "Original"],
] as const)("runs %s → %s → %s with a fresh native map each time", async (...modes) => {
  const screen = await render(<MapDiagnosticRoute />);
  const map = () => screen.getByTestId("diagnostic-map");
  const expectedMapIds = {
    Original: "test-map-id",
    Default: undefined,
    Diagnostic: "ff9a89ad4b7211795769e17e",
  };

  expect(screen.getByText("Downloaded update ID test-update-id")).toBeTruthy();
  expect(screen.getByText("Channel preview · Runtime 1.0.0")).toBeTruthy();
  expect(screen.queryByTestId("diagnostic-map")).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: `Run ${modes[0]}` }));
  const firstMap = map().props;

  for (const [index, mode] of modes.entries()) {
    if (index > 0) {
      await fireEvent.press(screen.getByRole("button", { name: `Run ${mode}` }));
    }

    expect(screen.getAllByTestId("diagnostic-map")).toHaveLength(1);
    expect(map().props.googleMapId).toBe(expectedMapIds[mode]);
    if (mode === "Default") {
      expect(map().props).not.toHaveProperty("googleMapId");
    }

    expect(map().props).toMatchObject({
      initialRegion: firstMap.initialRegion,
      mapType: firstMap.mapType,
      provider: firstMap.provider,
      style: firstMap.style,
    });
    expect(mockMountMap).toHaveBeenCalledTimes(index + 1);
    expect(mockMountMap).toHaveBeenNthCalledWith(index + 1, expectedMapIds[mode]);
    expect(mockUnmountMap).toHaveBeenCalledTimes(index);
  }

  await act(() => firstMap.onMapLoaded());
  expect(screen.getByText("Ready Waiting · Loaded Waiting")).toBeTruthy();
  expect(screen.getAllByText("Ready Not observed · Loaded Not observed")).toHaveLength(2);
});

it("records layout, callbacks, the 30-second timeout, and a late load", async () => {
  const screen = await render(<MapDiagnosticRoute />);
  await fireEvent.press(screen.getByRole("button", { name: "Run Diagnostic" }));

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

  await fireEvent.press(screen.getByRole("button", { name: "Run Original" }));
  expect(screen.getByText("Ready 200 ms · Loaded 30500 ms")).toBeTruthy();
  expect(screen.getByText("Load timeout at 30 s")).toBeTruthy();
});

it("keeps both controls available when the original Map ID is missing", async () => {
  delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID;
  const screen = await render(<MapDiagnosticRoute />);

  expect(screen.getByRole("button", { name: "Run Original" })).toBeDisabled();
  await fireEvent.press(screen.getByRole("button", { name: "Run Diagnostic" }));
  expect(screen.getByTestId("diagnostic-map").props.googleMapId)
    .toBe("ff9a89ad4b7211795769e17e");

  await fireEvent.press(screen.getByRole("button", { name: "Run Default" }));
  expect(screen.getByTestId("diagnostic-map").props).not.toHaveProperty("googleMapId");
});
