import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, fireEvent, render } from "@testing-library/react-native";
import { createRef } from "react";

import { standardAnalyticsReport } from "../../../__tests__/merchantAnalytics.fixtures";
import { visibilityReport } from "../../../__tests__/merchantPlusAnalytics.fixtures";
import { routePlanningReport } from "../../../__tests__/routePlanningAnalytics.fixtures";
import AnalyticsMeasurementSheet from "../AnalyitcsMeasurementSheet";
import AnalyticsRoutePlanningSheet from "../AnalyticsRoutePlanningSheet";
import AnalyticsVisibilityMeasurementSheet from "../AnalyticsVisibilityMeasurementSheet";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const { useImperativeHandle, useState } = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: View,
    BottomSheetModal: function MockModal({
      ref,
      children,
      onDismiss,
    }: {
      ref: unknown;
      children: React.ReactNode;
      onDismiss?: () => void;
    }) {
      const [visible, setVisible] = useState(false);
      useImperativeHandle(ref, () => ({
        present: () => setVisible(true),
        dismiss: () => {
          setVisible(false);
          onDismiss?.();
        },
      }));
      return visible ? <View>{children}</View> : null;
    },
  };
});

describe("Analytics measurement sheets without loaded reports", () => {
  it("keeps route-planning definitions available without data and shows tracking dates in its details", async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const screen = await render(
      <AnalyticsRoutePlanningSheet sheetRef={sheetRef} />,
    );
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText("About route-planning activity")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Show detailed counting rules and data coverage",
      }),
    );
    expect(screen.queryByText("Tracking started")).toBeNull();
    await screen.rerender(
      <AnalyticsRoutePlanningSheet
        sheetRef={sheetRef}
        report={routePlanningReport({
          tracking_started_at: "2026-10-16T16:30:00Z",
        })}
      />,
    );
    expect(screen.getByText("Tracking started")).toBeTruthy();
    expect(screen.getByText(/Oct 17, 12:30 AM/)).toBeTruthy();
    expect(screen.queryByText(/Invalid Date/)).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Close route-planning information",
      }),
    );
    expect(screen.queryByText("About route-planning activity")).toBeNull();
  });
  it("opens Business Overview definitions without data, then safely adds report details", async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const screen = await render(
      <AnalyticsMeasurementSheet sheetRef={sheetRef} report={null} />,
    );
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText("Understanding your analytics")).toBeTruthy();
    expect(screen.getByText("Activity during selected dates")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Detailed counting rules and data dates",
      }),
    );
    expect(screen.getByText("Reviews and replies")).toBeTruthy();
    expect(screen.queryByText(/Replies checked through/)).toBeNull();

    await screen.rerender(
      <AnalyticsMeasurementSheet
        sheetRef={sheetRef}
        report={standardAnalyticsReport()}
      />,
    );
    expect(screen.getByText(/Replies checked through/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Close analytics information",
      }),
    );
    expect(screen.queryByText("Understanding your analytics")).toBeNull();
    await act(async () => sheetRef.current?.present());
    expect(
      screen.getByRole("button", {
        name: "Detailed counting rules and data dates",
      }).props.accessibilityState.expanded,
    ).toBe(false);
  });

  it("opens visibility definitions while loading and guards missing report dates and sources", async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const screen = await render(
      <AnalyticsVisibilityMeasurementSheet
        sheetRef={sheetRef}
        metricKey="profile_visits"
        metricLabel="Profile visits"
        interval="weekly"
      />,
    );
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText("About visibility trends")).toBeTruthy();
    expect(screen.getByText("Weekly grouping")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Detailed measurement rules and sources",
      }),
    );
    expect(screen.getByText("How activity is counted")).toBeTruthy();
    expect(screen.queryByText("Reporting dates")).toBeNull();
    expect(screen.queryByText("Source and comparison information")).toBeNull();

    await screen.rerender(
      <AnalyticsVisibilityMeasurementSheet
        sheetRef={sheetRef}
        metricKey="profile_visits"
        metricLabel="Profile visits"
        interval="weekly"
        metric={visibilityReport("weekly").metrics.profile_visits}
      />,
    );
    expect(screen.getByText("Reporting dates")).toBeTruthy();
    expect(screen.getByText("Source and comparison information")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", {
        name: "Close visibility information",
      }),
    );
    expect(screen.queryByText("About visibility trends")).toBeNull();
  });
});
