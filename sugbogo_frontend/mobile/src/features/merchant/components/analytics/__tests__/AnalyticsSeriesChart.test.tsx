import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsSeriesChart from "../AnalyticsSeriesChart";
import type { AnalyticsPlotPoint } from "../../../utils/merchantPlusAnalytics.utils";

const points: AnalyticsPlotPoint[] = [1, 2, 3, 4].map((day) => ({
  date: `2026-10-0${day}`,
  start: `2026-10-0${day}T00:00:00+08:00`,
  end_exclusive: `2026-10-0${day + 1}T00:00:00+08:00`,
  value: day === 1 ? 0 : day,
}));

describe("AnalyticsSeriesChart", () => {
  it.each([1, 2, 3])(
    "keeps %i sparse observations visible without inventing a trend",
    async (count) => {
      const screen = await render(
        <AnalyticsSeriesChart
          points={points.slice(0, count)}
          interval="daily"
          label="Visits"
        />,
      );

      expect(screen.getAllByTestId("analytics-observed-point")).toHaveLength(
        count,
      );
      expect(screen.queryAllByTestId("analytics-line-segment")).toHaveLength(0);
      expect(screen.getByLabelText("Visits, Oct 1: 0")).toBeTruthy();
      expect(screen.getByTestId("analytics-chart-viewport")).toHaveStyle({
        height: 196,
        flexGrow: 0,
      });
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

    expect(
      screen.getByText("No recorded buckets returned for this period."),
    ).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
  });
});
