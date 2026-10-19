import { fireEvent, render } from "@testing-library/react-native";
import AnalyticsSeriesChart from "../AnalyticsSeriesChart";
import { bucket } from "../../../__tests__/merchantPlusAnalytics.fixtures";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

const point = (date: string, value: number, days = 1) => ({
  ...bucket(date, days),
  value,
});

describe("AnalyticsSeriesChart calendar columns", () => {
  it.each([1, 2])(
    "shows %i observations directly without an empty-state canvas",
    async (count) => {
      const screen = await render(
        <AnalyticsSeriesChart
          points={[point("2026-10-01", 0), point("2026-10-03", 7)].slice(
            0,
            count,
          )}
          interval="daily"
          label="Visits"
        />,
      );
      expect(screen.getByLabelText("Visits, Oct 1: 0")).toBeTruthy();
      if (count === 2) {
        expect(screen.getByLabelText("Visits, Oct 3: 7")).toBeTruthy();
      }
      expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
      expect(screen.queryByTestId("analytics-chart-empty-state")).toBeNull();
      expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    },
  );

  it("positions daily columns by date instead of compressing missing days", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          point("2026-10-01", 2),
          point("2026-10-03", 6),
          point("2026-10-04", 4),
        ]}
        interval="daily"
        label="Visits"
      />,
    );
    const first = screen.getByTestId("analytics-column-2026-10-01").props.x;
    const third = screen.getByTestId("analytics-column-2026-10-03").props.x;
    const fourth = screen.getByTestId("analytics-column-2026-10-04").props.x;
    expect(third - first).toBeCloseTo(2 * (fourth - third));
    expect(screen.getByTestId("analytics-missing-2026-10-02")).toBeTruthy();
    expect(screen.queryByTestId("analytics-zero-2026-10-02")).toBeNull();
  });

  it("shows consecutive daily counts without missing marks", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          point("2026-10-01", 2),
          point("2026-10-02", 0),
          point("2026-10-03", 4),
        ]}
        interval="daily"
        label="Visits"
      />,
    );
    expect(screen.getByTestId("analytics-zero-2026-10-02")).toBeTruthy();
    expect(screen.queryAllByTestId(/^analytics-missing-/)).toHaveLength(0);
    expect(screen.queryByTestId("analytics-column-2026-10-02")).toBeNull();
  });

  it("preserves missing Monday weeks separately from explicit zero weeks and expands exact values", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          point("2026-09-21", 2, 7),
          point("2026-09-28", 0, 7),
          point("2026-10-12", 3, 7),
        ]}
        interval="weekly"
        label="Saves"
        total={5}
      />,
    );
    expect(screen.getByTestId("analytics-zero-2026-09-28")).toBeTruthy();
    expect(screen.getByTestId("analytics-missing-2026-10-05")).toBeTruthy();
    expect(screen.getByRole("image").props.accessibilityLabel).toContain(
      "View exact values for individual dates",
    );
    const toggle = screen.getByRole("button", {
      name: "View Saves exact values",
    });
    expect(toggle.props.accessibilityState.expanded).toBe(false);
    await fireEvent.press(toggle);
    expect(screen.getByLabelText("Saves, Sep 28 – Oct 4: 0")).toBeTruthy();
    expect(
      screen.getByLabelText("Saves, Oct 5 – Oct 11: No data"),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Hide Saves exact values" }),
    );
    expect(
      screen.queryByLabelText("Saves, Oct 5 – Oct 11: No data"),
    ).toBeNull();
  });

  it("labels clipped first and last weeks with their actual dates and partial-week context", async () => {
    const range = {
      start: "2026-09-24T00:00:00+08:00",
      end_exclusive: "2026-10-06T12:00:00+08:00",
    };
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          { ...point("2026-09-21", 2, 7), start: range.start },
          point("2026-09-28", 3, 7),
          { ...point("2026-10-05", 1, 7), end_exclusive: range.end_exclusive },
        ]}
        range={range}
        interval="weekly"
        label="Reviews"
      />,
    );
    expect(screen.getByText(/Partial weeks cover fewer days/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "View Reviews exact values" }),
    );
    expect(
      screen.getByLabelText("Reviews, Sep 24 – Sep 27 · partial week: 2"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Reviews, Oct 5 – Oct 6 · partial week: 1"),
    ).toBeTruthy();
  });

  it("keeps a 90-day daily calendar scrollable instead of compressing its columns", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          point("2026-07-21", 1),
          point("2026-08-21", 2),
          point("2026-10-18", 3),
        ]}
        range={bucket("2026-07-21", 90)}
        interval="daily"
        label="Visits"
      />,
    );
    expect(
      screen.getByTestId("analytics-chart-viewport").props.horizontal,
    ).toBe(true);
    expect(
      screen.getByTestId("analytics-chart-viewport").props
        .showsHorizontalScrollIndicator,
    ).toBe(true);
    expect(screen.getByText("Swipe for more")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "View Visits exact values" }),
    );
    expect(screen.getByLabelText("Visits, Oct 18: 3")).toBeTruthy();
    expect(screen.getByLabelText("Visits, Jul 22: No data")).toBeTruthy();
  });

  it("keeps an empty series distinct from a known zero total", async () => {
    const screen = await render(
      <AnalyticsSeriesChart points={[]} interval="daily" label="Visits" />,
    );
    expect(screen.getByText("Dated counts are unavailable")).toBeTruthy();
    expect(
      screen.queryByText("No recorded activity in this period"),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    await screen.rerender(
      <AnalyticsSeriesChart
        points={[]}
        total={0}
        interval="daily"
        label="Visits"
      />,
    );
    expect(
      screen.getByText("No recorded activity in this period"),
    ).toBeTruthy();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not turn a reported zero into a period-wide zero when the total is unavailable", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[point("2026-10-01", 0)]}
        total={null}
        interval="daily"
        label="Visits"
      />,
    );
    expect(screen.getByLabelText("Visits, Oct 1: 0")).toBeTruthy();
    expect(
      screen.queryByText("No recorded activity in this period"),
    ).toBeNull();
  });

  it("renders ordered line segments through genuine zeros without changing default bars", async () => {
    const points = [
      point("2026-10-03", 4),
      point("2026-10-01", 2),
      point("2026-10-02", 0),
    ];
    const screen = await render(
      <AnalyticsSeriesChart
        points={points}
        interval="daily"
        label="Saves"
        variant="line"
      />,
    );
    expect(screen.getByRole("image").props.accessibilityLabel).toContain(
      "Line chart",
    );
    expect(
      screen.getByTestId("analytics-line-2026-10-01-2026-10-02"),
    ).toBeTruthy();
    expect(
      screen.getByTestId("analytics-line-2026-10-02-2026-10-03"),
    ).toBeTruthy();
    expect(screen.getAllByTestId(/^analytics-area-/)).toHaveLength(2);
    expect(
      screen.getByTestId("analytics-area-2026-10-01-2026-10-02").props.fill
        .brushRef,
    ).toBe("analytics-line-fill");
    const zero = screen.getByTestId("analytics-zero-2026-10-02");
    expect(
      screen.getByTestId("analytics-line-2026-10-01-2026-10-02").props.y2,
    ).toBe(zero.props.cy);
    expect(screen.queryAllByTestId(/^analytics-column-/)).toHaveLength(0);
    await fireEvent.press(
      screen.getByRole("button", { name: "View Saves exact values" }),
    );
    expect(screen.getByLabelText("Saves, Oct 2: 0")).toBeTruthy();
    await screen.rerender(
      <AnalyticsSeriesChart points={points} interval="daily" label="Saves" />,
    );
    expect(screen.getByTestId("analytics-column-2026-10-01")).toBeTruthy();
    expect(screen.queryAllByTestId(/^analytics-line-/)).toHaveLength(0);
    expect(screen.queryAllByTestId(/^analytics-area-/)).toHaveLength(0);
  });

  it("breaks a line at missing weeks and retains exact partial-week values", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[
          point("2026-09-21", 2, 7),
          point("2026-09-28", 0, 7),
          point("2026-10-12", 3, 3),
        ]}
        interval="weekly"
        label="Saves"
        variant="line"
        total={5}
      />,
    );
    expect(screen.getAllByTestId(/^analytics-line-/)).toHaveLength(1);
    expect(screen.getAllByTestId(/^analytics-area-/)).toHaveLength(1);
    expect(screen.getByTestId("analytics-missing-2026-10-05")).toBeTruthy();
    expect(screen.queryByTestId("analytics-zero-2026-10-05")).toBeNull();
    expect(
      screen.queryByTestId("analytics-line-2026-09-28-2026-10-12"),
    ).toBeNull();
    expect(
      screen.queryByTestId("analytics-area-2026-09-28-2026-10-12"),
    ).toBeNull();
    expect(screen.getByTestId("analytics-point-2026-10-12")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "View Saves exact values" }),
    );
    expect(
      screen.getByLabelText("Saves, Oct 5 – Oct 11: No data"),
    ).toBeTruthy();
    expect(
      screen.getByLabelText("Saves, Oct 12 – Oct 14 · partial week: 3"),
    ).toBeTruthy();
  });

  it("keeps sparse and zero states when the line presentation is requested", async () => {
    const screen = await render(
      <AnalyticsSeriesChart
        points={[point("2026-10-01", 2)]}
        interval="daily"
        label="Saves"
        variant="line"
        total={2}
      />,
    );
    expect(screen.getByLabelText("Saves, Oct 1: 2")).toBeTruthy();
    expect(screen.getByText("Not enough data for a trend yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
    expect(screen.queryByTestId("analytics-chart-viewport")).toBeNull();
    await screen.rerender(
      <AnalyticsSeriesChart
        points={[]}
        interval="daily"
        label="Saves"
        variant="line"
        total={0}
      />,
    );
    expect(
      screen.getByText("No recorded activity in this period"),
    ).toBeTruthy();
    await screen.rerender(
      <AnalyticsSeriesChart
        points={[]}
        interval="daily"
        label="Saves"
        variant="line"
        total={null}
      />,
    );
    expect(screen.getByText("Dated counts are unavailable")).toBeTruthy();
  });
});
