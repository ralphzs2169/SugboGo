import { render } from "@testing-library/react-native";
import BusinessDetailRoute from "@/app/(explorer)/business/[businessId]";
import ExploreBusinessProfileScreen from "../ExploreBusinessProfileScreen";
import { DISCOVERY_SOURCES } from "../../constants/discoverySources";

let mockParams: Record<string, unknown>;
jest.mock("expo-router", () => ({ useLocalSearchParams: () => mockParams }));
jest.mock("../ExploreBusinessProfileScreen", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));

it.each(DISCOVERY_SOURCES)(
  "passes validated %s into the actual profile screen",
  async (source) => {
    mockParams = {
      businessId: "42",
      distance: "1.2",
      distanceAccuracy: "10",
      profileSource: source,
    };
    await render(<BusinessDetailRoute />);
    expect(
      jest.mocked(ExploreBusinessProfileScreen).mock.calls.at(-1)?.[0],
    ).toMatchObject({
      businessId: 42,
      distance: 1.2,
      distanceAccuracy: 10,
      profileSource: source,
    });
  },
);
it("falls back to UNKNOWN between openings instead of retaining stale or excluded origins", async () => {
  mockParams = { businessId: "42", profileSource: "MAP" };
  const screen = await render(<BusinessDetailRoute />);
  for (const source of [
    undefined,
    "MY_REVIEWS",
    "VOUCH_HISTORY",
    ["MAP"],
    "unsupported",
  ]) {
    mockParams = { businessId: "43", profileSource: source };
    await screen.rerender(<BusinessDetailRoute />);
    expect(
      jest.mocked(ExploreBusinessProfileScreen).mock.calls.at(-1)?.[0],
    ).toMatchObject({ businessId: 43, profileSource: "UNKNOWN" });
  }
});
