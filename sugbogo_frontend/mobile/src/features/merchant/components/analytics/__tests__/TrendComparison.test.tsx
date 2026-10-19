import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import colors from "tailwindcss/colors";

import { theme } from "@/constants/theme";
import { standardAnalyticsReport } from "../../../__tests__/merchantAnalytics.fixtures";
import {
  reviewReport,
  visibilityReport,
  pocketReport,
} from "../../../__tests__/merchantPlusAnalytics.fixtures";
import type { KpiTrend } from "../../../utils/merchantKpiComparisons.utils";
import AnalyticsActivityOverview from "../AnalyticsActivityOverview";
import TrendComparison from "../TrendComparison";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: ({
    name,
    color,
    size,
    accessible,
  }: {
    name: string;
    color: string;
    size: number;
    accessible?: boolean;
  }) => {
    const { View } = jest.requireActual("react-native");
    return (
      <View
        testID={`metric-icon-${name}`}
        color={color}
        size={size}
        accessible={accessible}
      />
    );
  },
}));

describe("approved KPI trend presentation", () => {
  it.each([
    {
      direction: "up",
      value: 12,
      unit: "percentage_points",
      text: "+12 pp",
      icon: "trending-up",
      color: colors.emerald[700],
      textClass: "text-emerald-700",
      description: "Increase: +12 pp compared with the previous period",
    },
    {
      direction: "down",
      value: -8.2,
      unit: "percent",
      text: "−8.2%",
      icon: "trending-down",
      color: colors.red[700],
      textClass: "text-red-700",
      description: "Decrease: −8.2% compared with the previous period",
    },
    {
      direction: "unchanged",
      value: 0,
      unit: "percent",
      text: "0",
      icon: "minus",
      color: theme.extends.colors.text.secondary,
      textClass: "text-text-secondary",
      description: "No change compared with the previous period",
    },
  ] as const)(
    "uses the approved $direction direction and styling",
    async (testCase) => {
      const screen = await render(<TrendComparison trend={testCase} />);
      const icon = screen.getByTestId(`metric-icon-${testCase.icon}`);
      expect(icon.props.color).toBe(testCase.color);
      expect(icon.props.size).toBe(15);
      expect(icon.props.accessible).toBe(false);
      expect(screen.getByText(testCase.text).props.className).toContain(
        testCase.textClass,
      );
      expect(
        StyleSheet.flatten(screen.getByText(testCase.text).props.style).color,
      ).toBe(testCase.color);
      expect(screen.getByText(testCase.text).props.className).toContain(
        "font-nunito-semibold",
      );
      expect(screen.getByLabelText(testCase.description)).toBeTruthy();
      const context = screen.getByText("vs prev");
      expect(StyleSheet.flatten(context.props.style).color).toBe(testCase.color);
      expect(context.props.className).toContain(testCase.textClass);
      expect(context.props.className).toContain("font-nunito ");
      expect(context.props.className).not.toContain("font-nunito-semibold");
      expect(screen.queryByText("vs previous period")).toBeNull();
      expect(screen.queryByText("vs previous")).toBeNull();
    },
  );

  it.each([
    ["count", "+3"],
    ["percent", "+3%"],
    ["percentage_points", "+3 pp"],
  ] as const)("retains the existing %s formatter", async (unit, value) => {
    const trend: KpiTrend = { value: 3, direction: "up", unit };
    const screen = await render(<TrendComparison trend={trend} />);
    expect(screen.getByText(value)).toBeTruthy();
  });

  it("does not replace a missing comparison with a stable indicator", async () => {
    const screen = await render(<TrendComparison />);
    expect(screen.toJSON()).toBeNull();
  });

  it("keeps long values and period context free to wrap", async () => {
    const screen = await render(
      <TrendComparison
        trend={{ value: 123456789, direction: "up", unit: "count" }}
      />,
    );
    const label = screen.getByText("+123,456,789");
    expect(label.props.numberOfLines).toBeUndefined();
    expect(label.props.allowFontScaling).not.toBe(false);
    expect(label.props.className).toContain("shrink");
  });

  it("preserves coverage suppression, Standard values, vouches, and reply progress", async () => {
    const report = standardAnalyticsReport();
    const screen = await render(
      <AnalyticsActivityOverview
        report={report}
        plusVisibility={visibilityReport()}
        plusPocket={pocketReport()}
      />,
    );
    expect(screen.queryByText("vs prev")).toBeNull();
    expect(screen.getByLabelText(/^Profile visits:/)).toBeTruthy();
    expect(screen.getByLabelText(/^Saves:/)).toBeTruthy();
    const vouches = screen.getByLabelText(/^Current vouches:/);
    expect(vouches.props.accessibilityLabel).not.toContain("previous period");
    expect(
      screen.getByTestId("analytics-reply-progress-fill").props.style,
    ).toEqual({
      width: `${report.reviews.reply_rate}%`,
    });
  });

  it("includes direction and period in grouped KPI accessibility labels", async () => {
    const plusReviews = reviewReport();
    plusReviews.published_review_count_change = {
      value: 3,
      direction: "up",
      unit: "count",
      reason: null,
    };
    const screen = await render(
      <AnalyticsActivityOverview
        report={standardAnalyticsReport()}
        plusReviews={plusReviews}
      />,
    );
    expect(
      screen.getByLabelText(
        /^New reviews:.*Increase: \+3 compared with the previous period/,
      ),
    ).toBeTruthy();
    expect(
      screen.getByTestId("analytics-reply-card").props.accessibilityLabel,
    ).toContain("Increase: +25 pp compared with the previous period");
    expect(screen.getAllByText("vs prev")).toHaveLength(2);
  });
});
