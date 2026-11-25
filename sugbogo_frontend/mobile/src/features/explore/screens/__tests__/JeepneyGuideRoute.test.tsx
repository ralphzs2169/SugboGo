import { render } from "@testing-library/react-native";
import { Redirect } from "expo-router";

import JeepneyGuideRoute from "@/app/(explorer)/business/[businessId]/jeepney-guide";
import { experimentalItinerariesEnabled } from "@/features/explore/constants/experimentalItinerary.constants";
import JeepneyGuideScreen from "@/features/explore/screens/JeepneyGuideScreen";

jest.mock("expo-router", () => ({
  Redirect: jest.fn(() => null),
  useLocalSearchParams: () => ({ businessId: "42" }),
}));

jest.mock("@/features/explore/constants/experimentalItinerary.constants", () => ({
  experimentalItinerariesEnabled: jest.fn(),
}));

jest.mock("@/features/explore/screens/JeepneyGuideScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

const originalDevelopmentMode = __DEV__;

afterEach(() => {
  Object.defineProperty(globalThis, "__DEV__", { value: originalDevelopmentMode });
});

it("redirects the opted-in development guide to the same business's itinerary preview", async () => {
  Object.defineProperty(globalThis, "__DEV__", { value: true });
  jest.mocked(experimentalItinerariesEnabled).mockReturnValue(true);

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(Redirect).mock.calls[0]?.[0].href).toEqual({
    pathname: "/(explorer)/business/[businessId]/experimental-itineraries",
    params: { businessId: "42" },
  });
  expect(JeepneyGuideScreen).not.toHaveBeenCalled();
});

it.each([
  { development: true, experimentEnabled: false },
  { development: false, experimentEnabled: true },
  { development: false, experimentEnabled: false },
])("renders the legacy guide with development=$development and experimentEnabled=$experimentEnabled", async ({
  development,
  experimentEnabled,
}) => {
  Object.defineProperty(globalThis, "__DEV__", { value: development });
  jest.mocked(experimentalItinerariesEnabled).mockReturnValue(experimentEnabled);

  await render(<JeepneyGuideRoute />);

  expect(jest.mocked(JeepneyGuideScreen).mock.calls[0]?.[0]).toEqual({ businessId: 42 });
  expect(Redirect).not.toHaveBeenCalled();
});
