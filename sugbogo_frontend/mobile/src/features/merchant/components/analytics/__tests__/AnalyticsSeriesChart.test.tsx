import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsSeriesChart from "../AnalyticsSeriesChart";
import type { AnalyticsPlotPoint } from "../../../utils/merchantPlusAnalytics.utils";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

const points: AnalyticsPlotPoint[] = [1, 2, 3, 4].map((day) => ({
  date: `2026-10-0${day}`,
  start: `2026-10-0${day}T00:00:00+08:00`,
  end_exclusive: `2026-10-0${day + 1}T00:00:00+08:00`,
  value: day === 1 ? 0 : day,
}));

describe("AnalyticsSeriesChart", () => {
  it.each([1, 2])(
    "shows %i observations as exact values without inventing a trend",
    async (count) => {
      const screen = await render(
        <AnalyticsSeriesChart
          points={points.slice(0, count)}
          interval="daily"
          label="Visits"
        />,
      );

      expect(screen.getByText("Not enough data for a trend yet")).toBeTruthy();
      expect(screen.getByTestId("analytics-chart-empty-state")).toHaveStyle({
        minHeight: 196,
      });
      expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
      expect(screen.queryAllByTestId("analytics-line-segment")).toHaveLength(0);
      expect(screen.getByLabelText("Visits, Oct 1: 0")).toBeTruthy();
      if (count === 2) {
        expect(screen.getByLabelText("Visits, Oct 2: 2")).toBeTruthy();
      }
    },
  );

  it("connects sufficient adjacent observations and retains its height after layout", async () => {
    const screen = await render(
      <AnalyticsSeriesChart points={points} interval="daily" label="Visits" />,
    );

    expect(screen.getAllByTestId("analytics-line-segment")).toHaveLength(1);
    await fireEvent(
      screen.getByTestId("analytics-chart-viewport").parent!,
      "layout",
      {
        nativeEvent: { layout: { width: 280 } },
      },
    );
    expect(screen.getByTestId("analytics-chart-viewport")).toHaveStyle({
      height: 196,
    });
    expect(screen.getAllByTestId("analytics-observed-point")).toHaveLength(4);
  });

  it("keeps an empty response distinct from observed zero activity", async () => {
    const screen = await render(
      <AnalyticsSeriesChart points={[]} interval="daily" label="Visits" />,
    );

    expect(screen.getByText("Dated counts are unavailable")).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
  });

  it("uses a period total of zero for an informative empty state without Retry", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[]}
        interval="daily"
        label="Visits"
        total={0}
      />,
    );
    expect(
      screen.getByText("No recorded activity in this period"),
    ).toBeTruthy();
    expect(screen.getByTestId("analytics-chart-empty-state")).toHaveStyle({
      minHeight: 196,
    });
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
  });

  it("does not treat returned zero buckets as a known period total", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[points[0]]}
        interval="daily"
        label="Visits"
        total={null}
      />,
    );
    expect(screen.getByLabelText("Visits, Oct 1: 0")).toBeTruthy();
    expect(
      screen.queryByText("No recorded activity in this period"),
    ).toBeNull();
  });

  it("preserves a gap between observed runs without drawing a connecting segment", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[points[0], points[1], points[3]]}
        interval="daily"
        label="Visits"
      />,
    );
    expect(screen.getAllByTestId("analytics-observed-point")).toHaveLength(3);
    const segment = screen.getByTestId("analytics-line-segment");
    expect(segment.props.d.match(/L /g)).toHaveLength(1);
  });

  it("uses exact values for isolated observations even when several are returned", async () => {
    const isolated = [1, 3, 5].map((day, index) => ({
      ...points[index],
      date: `2026-10-0${day}`,
      start: `2026-10-0${day}T00:00:00+08:00`,
    }));
    const screen = await render(
      <AnalyticsSeriesChart
        points={isolated}
        interval="daily"
        label="Visits"
      />,
    );
    expect(screen.getByText("Not enough data for a trend yet")).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
  });

  it("uses a weekly comparison for two active weeks but exact counts for one", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[points[1], points[2]]}
        interval="weekly"
        kind="bar"
        label="Saves"
        total={5}
      />,
    );
    expect(screen.getByTestId("analytics-chart-viewport")).toBeTruthy();
    await screen.rerender(
      <AnalyticsSeriesChart
        points={[points[0], points[2]]}
        interval="weekly"
        kind="bar"
        label="Saves"
        total={3}
      />,
    );
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
    expect(screen.getByLabelText("Saves, Oct 1: 0")).toBeTruthy();
    expect(screen.getByLabelText("Saves, Oct 3: 3")).toBeTruthy();
  });

  it("keeps long limited lists compact while allowing access to every returned observation", async () => {
    const observations = [1, 3, 5, 7, 9].map((day) => ({
      date: `2026-10-0${day}`,
      start: `2026-10-0${day}T00:00:00+08:00`,
      end_exclusive: new Date(
        Date.parse(`2026-10-0${day}T00:00:00+08:00`) + 86_400_000,
      ).toISOString(),
      value: day,
    }));
    const screen = await render(
      <AnalyticsSeriesChart
        points={observations}
        interval="daily"
        label="Visits"
      />,
    );
    expect(screen.queryByLabelText("Visits, Oct 1: 1")).toBeNull();
    expect(
      screen.getByText(/Showing the latest four recorded dates/),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show all Visits values" }),
    );
    expect(screen.getByLabelText("Visits, Oct 1: 1")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show fewer Visits values" }),
    );
    expect(screen.queryByLabelText("Visits, Oct 1: 1")).toBeNull();
  });
});
