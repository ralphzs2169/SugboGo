import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsRoutePlanning from "../AnalyticsRoutePlanning";
import { routePlanningReport } from "../../../__tests__/routePlanningAnalytics.fixtures";
import { standardAnalyticsMeta } from "../../../__tests__/merchantAnalytics.fixtures";

const mockPresent = jest.fn();
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@/shared/components/Skeleton", () => ({
  __esModule: true,
  default: jest.requireActual("react-native").View,
}));
jest.mock("../AnalyticsRoutePlanningSheet", () => ({
  __esModule: true,
  default: function MockRoutePlanningSheet({
    sheetRef,
  }: {
    sheetRef: { current: unknown };
  }) {
    const { useImperativeHandle } = jest.requireActual("react");
    useImperativeHandle(sheetRef, () => ({ present: mockPresent }));
    return null;
  },
}));

describe("route-planning activity presentation", () => {
  const retry = jest.fn();
  beforeEach(() => jest.clearAllMocks());
  it("shows exact counts and proportional method bars with a measurement action", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning
        data={routePlanningReport()}
        loading={false}
        error={null}
        onRetry={retry}
      />,
    );
    expect(screen.getByLabelText("Recorded route requests: 4")).toBeTruthy();
    expect(screen.getByLabelText("Explorer accounts: 3")).toBeTruthy();
    expect(
      screen.getByLabelText("Road Route: 3 recorded requests"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("route-planning-bar-road").props.style.width,
    ).toBe("75%");
    expect(
      screen.getByTestId("route-planning-bar-jeepney").props.style.width,
    ).toBe("25%");
    await fireEvent.press(
      screen.getByRole("button", { name: "About route-planning activity" }),
    );
    expect(mockPresent).toHaveBeenCalledTimes(1);
  });
  it("keeps genuine zero counts and no fabricated bar or Retry", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning
        data={routePlanningReport({
          total_requests: 0,
          distinct_explorer_accounts: 0,
          road_route_requests: 0,
          jeepney_requests: 0,
        })}
        loading={false}
        error={null}
        onRetry={retry}
      />,
    );
    expect(screen.getByLabelText("Recorded route requests: 0")).toBeTruthy();
    expect(screen.getByText(/No recorded route requests/)).toBeTruthy();
    expect(screen.queryByTestId("route-planning-bar-road")).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
  it("preserves available counts when part of a report is unavailable", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning
        data={routePlanningReport({
          distinct_explorer_accounts: null,
          jeepney_requests: null,
        })}
        loading={false}
        error={null}
        onRetry={retry}
      />,
    );
    expect(screen.getByLabelText("Recorded route requests: 4")).toBeTruthy();
    expect(
      screen.getByLabelText("Explorer accounts: Unavailable"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Road Route: 3 recorded requests"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Jeepney guidance: Unavailable recorded requests"),
    ).toBeTruthy();
    expect(
      screen.getByText(/Some route-planning counts are unavailable/),
    ).toBeTruthy();
    expect(screen.queryByTestId("route-planning-bar-jeepney")).toBeNull();
  });
  it("distinguishes unavailable source counts from zero and offers recovery", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning
        data={routePlanningReport({
          total_requests: null,
          distinct_explorer_accounts: null,
          road_route_requests: null,
          jeepney_requests: null,
          meta: {
            ...standardAnalyticsMeta(),
            availability: "unavailable",
            partial_reasons: ["route_source_unavailable"],
          },
        })}
        loading={false}
        error={null}
        onRetry={retry}
      />,
    );
    expect(
      screen.getByLabelText("Recorded route requests: Unavailable"),
    ).toBeTruthy();
    expect(screen.queryByText(/No recorded route requests/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Route-planning data unavailable. Retry",
      }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it("has independent loading and preserves values alongside a refresh error", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning loading error={null} onRetry={retry} />,
    );
    expect(
      screen.getByLabelText("Loading route-planning activity"),
    ).toBeTruthy();
    await screen.rerender(
      <AnalyticsRoutePlanning
        data={routePlanningReport()}
        loading={false}
        error={new Error("Offline")}
        onRetry={retry}
      />,
    );
    expect(screen.getByLabelText("Recorded route requests: 4")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: /Unable to refresh route-planning activity.*retry/i,
      }),
    );
    expect(retry).toHaveBeenCalledTimes(1);
  });
  it("retains partial recorded values and explains collection start without a misleading date", async () => {
    const screen = await render(
      <AnalyticsRoutePlanning
        data={routePlanningReport({
          tracking_started_at: "2026-10-16T16:30:00Z",
          meta: {
            ...standardAnalyticsMeta(),
            partial_reasons: [
              "tracking_started_during_period",
              "coverage_unverified",
            ],
          },
        })}
        loading={false}
        error={null}
        onRetry={retry}
      />,
    );
    expect(screen.getByLabelText("Recorded route requests: 4")).toBeTruthy();
    expect(
      screen.getByText(/Tracking began/).props.children.join(""),
    ).not.toContain("Invalid Date");
  });
});
