import { cleanup, fireEvent, render } from "@testing-library/react-native";

import { recentActivitySnapshot } from "../../../__tests__/merchantRecentActivity.fixtures";
import MerchantRecentActivity from "../MerchantRecentActivity";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("@/shared/components/DottedTimelineConnector", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

const defaults = {
  loading: false,
  refreshing: false,
  error: null,
  onRetry: jest.fn(),
  onReview: jest.fn(),
};

afterEach(async () => {
  await cleanup();
  jest.clearAllMocks();
});

it("makes only the review actionable while rendering vouches and saves as information", async () => {
  const screen = await render(
    <MerchantRecentActivity {...defaults} data={recentActivitySnapshot()} />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(1);
  await fireEvent.press(
    screen.getByRole("button", { name: /Angela Cruz left a review/ }),
  );
  expect(defaults.onReview).toHaveBeenCalledWith(123);
  expect(
    screen.getByText("Miguel Santos vouched for 2 specialties"),
  ).toBeTruthy();
  expect(screen.getByText("4 explorers saved your business")).toBeTruthy();
});

it("does not present a healthy empty state when save tracking is unavailable", async () => {
  const data = recentActivitySnapshot({
    items: [],
    is_partial: true,
    sources: {
      saves: { availability: "unavailable", coverage: "recorded_events_only" },
    },
  });
  const screen = await render(
    <MerchantRecentActivity {...defaults} data={data} />,
  );
  expect(
    screen.getByText("Save activity is temporarily unavailable"),
  ).toBeTruthy();
  expect(screen.queryByText("No recent activity yet")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry recent activity" }),
  );
  expect(defaults.onRetry).toHaveBeenCalledTimes(1);
});

it("retains cached activity and provides recovery after a refresh error", async () => {
  const screen = await render(
    <MerchantRecentActivity
      {...defaults}
      data={recentActivitySnapshot()}
      error={new Error("Unavailable")}
    />,
  );
  expect(screen.getByText("Couldn't refresh activity")).toBeTruthy();
  expect(screen.getByText("Angela Cruz left a review")).toBeTruthy();
  expect(screen.queryByText("No recent activity yet")).toBeNull();
});

it("shows the initial skeleton separately from request failure", async () => {
  const screen = await render(<MerchantRecentActivity {...defaults} loading />);
  expect(screen.getByLabelText("Loading recent activity")).toBeTruthy();
  expect(screen.queryByText("No recent activity yet")).toBeNull();
  await screen.rerender(
    <MerchantRecentActivity {...defaults} error={new Error("Unavailable")} />,
  );
  expect(screen.getByText("Activity unavailable")).toBeTruthy();
  expect(screen.queryByLabelText("Loading recent activity")).toBeNull();
});
