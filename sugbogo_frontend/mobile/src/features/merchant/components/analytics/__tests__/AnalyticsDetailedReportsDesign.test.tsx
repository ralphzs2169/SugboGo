import { createRef, useState } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { act, fireEvent, render } from "@testing-library/react-native";
import * as ReactNative from "react-native";
import {
  peerReport,
  timingReport,
} from "../../../__tests__/merchantAdvancedAnalytics.fixtures";
import type { MerchantAnalyticsPeriod } from "../../../types/merchantAnalytics.types";
import AnalyticsDetailHeader from "../AnalyticsDetailHeader";
import AnalyticsDetailContext from "../AnalyticsDetailContext";
import AnalyticsReportSheet from "../AnalyticsReportSheet";
import AnalyticsDetailMetric from "../AnalyticsDetailMetric";
import AnalyticsPeerComparisons from "../AnalyticsPeerComparisons";
import AnalyticsProfileVisitTiming from "../AnalyticsProfileVisitTiming";
import DiscoverySourcesMeasurementSheet from "../DiscoverySourcesMeasurementSheet";

jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual("../../../__tests__/analyticsSheet.mock")
    .analyticsSheetMock(),
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 16, left: 0, right: 0 }),
}));

function HeaderHarness() {
  const [period, setPeriod] = useState<MerchantAnalyticsPeriod>("30");
  return (
    <AnalyticsDetailHeader
      title="Pocket trends"
      description="Recorded save activity."
      period={period}
      onPeriodChange={setPeriod}
    />
  );
}

describe("detailed report design consistency", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps all segmented periods editable with a consistent report identity", async () => {
    const screen = await render(<HeaderHarness />);
    expect(screen.getByRole("header", { name: "Pocket trends" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Last 30 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    await fireEvent.press(screen.getByRole("button", { name: "Last 7 days" }));
    expect(
      screen.getByRole("button", { name: "Last 7 days" }).props
        .accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Last 90 days" })).toBeTruthy();
  });

  it("does not imply dashboard dates apply to stored insights", async () => {
    const screen = await render(
      <AnalyticsDetailHeader
        title="Review insights"
        description="Prepared using its own review dates."
      />,
    );
    expect(screen.queryByRole("button", { name: "Last 30 days" })).toBeNull();
  });

  it("opens and dismisses measurement sheets without losing the report", async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const screen = await render(
      <AnalyticsReportSheet
        sheetRef={sheetRef}
        title="About this report"
        closeLabel="Close report information"
      >
        <ReactNative.Text>Counting rules</ReactNative.Text>
      </AnalyticsReportSheet>,
    );
    expect(screen.queryByText("Counting rules")).toBeNull();
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText("Counting rules")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close report information" }),
    );
    expect(screen.queryByText("Counting rules")).toBeNull();
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText("Counting rules")).toBeTruthy();
  });

  it("preserves source definitions in the standardized sheet", async () => {
    const sheetRef = createRef<BottomSheetModal>();
    const screen = await render(
      <DiscoverySourcesMeasurementSheet sheetRef={sheetRef} />,
    );
    await act(async () => sheetRef.current?.present());
    expect(screen.getByText(/first successfully recorded source/)).toBeTruthy();
    expect(screen.getByText(/not independently verified/)).toBeTruthy();
    expect(screen.getByText(/not confirmed physical visits/)).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close visit-source information" }),
    );
    expect(screen.queryByText("About visit sources")).toBeNull();
  });

  it("retains partial availability outside the sheet and source notes inside", async () => {
    const meta = peerReport().meta;
    meta.availability = "partial";
    meta.coverage_verified = false;
    const screen = await render(
      <AnalyticsDetailContext
        meta={meta}
        note="Server measurement definition"
        title="About peer comparisons"
      />,
    );
    expect(screen.getByText(/Some activity may not be recorded/)).toBeTruthy();
    expect(screen.getByText(/some information may be missing/)).toBeTruthy();
    expect(screen.queryByText("Server measurement definition")).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Show Plus measurement details" }),
    );
    expect(screen.getByText("Server measurement definition")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close measurement information" }),
    );
    expect(screen.queryByText("Server measurement definition")).toBeNull();
  });

  it.each(["0", "—"])("keeps a %s primary metric distinct", async (value) => {
    const screen = await render(
      <AnalyticsDetailMetric label="Recorded saves" value={value} />,
    );
    expect(
      screen.getByLabelText(
        `Recorded saves: ${value === "—" ? "Unavailable" : value}`,
      ),
    ).toBeTruthy();
  });

  it("stacks comparisons and keeps timing cells scrollable at larger font sizes", async () => {
    jest
      .spyOn(ReactNative, "useWindowDimensions")
      .mockReturnValue({ width: 320, height: 640, scale: 1, fontScale: 2 });
    const screen = await render(
      <>
        <AnalyticsPeerComparisons report={peerReport()} retry={jest.fn()} />
        <AnalyticsProfileVisitTiming
          report={timingReport()}
          retry={jest.fn()}
        />
      </>,
    );
    expect(
      screen.getByTestId("analytics-peer-pair-profile_visits").props.className,
    ).not.toContain("flex-row");
    expect(screen.getByTestId("timing-heatmap-scroll").props.horizontal).toBe(
      true,
    );
    expect(
      screen.getByRole("button", { name: "Monday, 09:00–10:00: 2" }).props.style
        .width,
    ).toBeGreaterThanOrEqual(44);
    expect(screen.getByLabelText("Monday, 09:00–10:00: 2")).toBeTruthy();
  });
});
