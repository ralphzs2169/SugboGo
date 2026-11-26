import { render } from "@testing-library/react-native";
import { Redirect } from "expo-router";
import { Platform } from "react-native";

import JeepneyGuideRoute from "@/app/(explorer)/business/[businessId]/jeepney-guide";
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
const previousIosKey = process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;
const previousPlatform = Platform.OS;

beforeEach(() => {
  Object.defineProperty(Platform, "OS", { value: "android" });
});

afterEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: originalDevelopmentMode });
  Object.defineProperty(Platform, "OS", { value: previousPlatform });
  if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = previousFlag;
  if (previousIosKey === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = previousIosKey;
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

it.each(["android", "ios"])("opens the geometric guide from the regular release entry on %s", async (platform) => {
  Object.defineProperty(globalThis, "__DEV__", { value: false });
  Object.defineProperty(Platform, "OS", { value: platform });
  process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = "true";
  process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY = "test-ios-key";

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(Redirect).mock.calls[0]?.[0].href).toEqual({
    pathname: "/(explorer)/business/[businessId]/experimental-itineraries",
    params: { businessId: "42" },
  });
  expect(JeepneyGuideScreen).not.toHaveBeenCalled();
});

it.each([
  { development: false, flag: undefined },
  { development: false, flag: "false" },
  { development: true, flag: "false" },
])("opens the legacy guide when the feature is off (%o)", async ({ development, flag }) => {
  Object.defineProperty(globalThis, "__DEV__", { value: development });
  if (flag === undefined) delete process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED;
  else process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = flag;

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(JeepneyGuideScreen).mock.calls[0]?.[0]).toEqual({ businessId: 42 });
  expect(Redirect).not.toHaveBeenCalled();
});

it("keeps the legacy guide on iOS without native Google Maps provisioning", async () => {
  Object.defineProperty(globalThis, "__DEV__", { value: false });
  Object.defineProperty(Platform, "OS", { value: "ios" });
  process.env.EXPO_PUBLIC_EXPERIMENTAL_ITINERARIES_ENABLED = "true";
  delete process.env.EXPO_PUBLIC_EXPERIMENTAL_IOS_MAPS_API_KEY;

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(JeepneyGuideScreen).mock.calls[0]?.[0]).toEqual({ businessId: 42 });
  expect(Redirect).not.toHaveBeenCalled();
});
