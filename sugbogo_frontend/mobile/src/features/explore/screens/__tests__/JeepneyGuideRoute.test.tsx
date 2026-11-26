import { render } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { Platform } from "react-native";

import JeepneyGuideRoute from "@/app/(explorer)/business/[businessId]/jeepney-guide";
import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import JeepneyGuideScreen from "@/features/explore/screens/JeepneyGuideScreen";

jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  useLocalSearchParams: () => ({ businessId: "42" }),
}));

jest.mock("@/features/explore/screens/JeepneyGuideScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const originalDevelopmentMode = __DEV__;
const previousFlag = process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
const previousPlatform = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "android" });
});

afterEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: originalDevelopmentMode });
  Object.defineProperty(Platform, "OS", { value: previousPlatform });
  if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = previousFlag;
});

it("opens the same business's geometric guide in development without a mobile flag", async () => {
  Object.defineProperty(globalThis, "__DEV__", { value: true });
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(Redirect).mock.calls[0]?.[0].href).toEqual({
    pathname: "/(explorer)/business/[businessId]/experimental-itineraries",
    params: { businessId: "42" },
  });
  expect(JeepneyGuideScreen).not.toHaveBeenCalled();
});

it("preserves the legacy release entry and existing experimental release opt-in", async () => {
  Object.defineProperty(globalThis, "__DEV__", { value: false });
  process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = "true";

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(JeepneyGuideScreen).mock.calls[0]?.[0]).toEqual({ businessId: 42 });
  expect(Redirect).not.toHaveBeenCalled();
  expect(experimentalItinerariesEnabled()).toBe(true);
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  expect(experimentalItinerariesEnabled()).toBe(false);
});
