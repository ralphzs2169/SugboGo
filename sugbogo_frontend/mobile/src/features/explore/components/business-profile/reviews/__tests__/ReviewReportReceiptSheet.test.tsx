import { act, fireEvent, render } from "@testing-library/react-native";
import type { RefObject } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";

import ReviewReportReceiptSheet from "../ReviewReportReceiptSheet";

const mockRefetch = jest.fn();
const mockUseMyReviewReport = jest.fn();

jest.mock("../../../../hooks/useBusinessReviews", () => ({
  useMyReviewReport: (...args: unknown[]) => mockUseMyReviewReport(...args),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    BottomSheetView: View,
    BottomSheetBackdrop: View,
  };
});
jest.mock("@/shared/components/Button", () => ({
  __esModule: true,
  default: ({ title, onPress }: { title: string; onPress: () => void }) => {
    const { Pressable, Text } = require("react-native");
    return <Pressable onPress={onPress}><Text>{title}</Text></Pressable>;
  },
}));

const sheetRef = { current: null } as RefObject<BottomSheetModal | null>;

describe("ReviewReportReceiptSheet", () => {
  beforeEach(() => {
    mockUseMyReviewReport.mockReset();
    mockRefetch.mockReset();
  });

  it("shows only the reporting user's reason, explanation, date, and friendly state", async () => {
    mockUseMyReviewReport.mockReturnValue({
      data: {
        reason: "misinformation",
        explanation: "The hours are incorrect.",
        submitted_at: "2026-10-13T09:00:00Z",
        state: "reviewed",
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    const screen = await render(
      <ReviewReportReceiptSheet
        sheetRef={sheetRef}
        reviewId={74}
        isOpen
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText("False or Misleading Information")).toBeTruthy();
    expect(screen.getByText("The hours are incorrect.")).toBeTruthy();
    expect(screen.getByText("Reviewed")).toBeTruthy();
    expect(screen.getByText("October 13, 2026")).toBeTruthy();
    expect(mockUseMyReviewReport).toHaveBeenCalledWith(74, true);
    await act(async () => {
      screen.unmount();
    });
  });

  it("omits an absent historical explanation and shows withdrawn state", async () => {
    mockUseMyReviewReport.mockReturnValue({
      data: {
        reason: "other",
        explanation: null,
        submitted_at: "2026-10-13T09:00:00Z",
        state: "withdrawn",
      },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    });
    const screen = await render(
      <ReviewReportReceiptSheet
        sheetRef={sheetRef}
        reviewId={74}
        isOpen
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText("Withdrawn")).toBeTruthy();
    expect(screen.queryByText("Your explanation")).toBeNull();
    await act(async () => {
      screen.unmount();
    });
  });

  it("shows a loading state", async () => {
    mockUseMyReviewReport.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: mockRefetch,
    });
    const screen = await render(
      <ReviewReportReceiptSheet
        sheetRef={sheetRef}
        reviewId={74}
        isOpen
        onDismiss={jest.fn()}
      />,
    );
    expect(screen.getByText("Loading your report...")).toBeTruthy();
    await act(async () => {
      screen.unmount();
    });
  });

  it("offers retry when the receipt cannot be loaded", async () => {
    mockUseMyReviewReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: mockRefetch,
    });
    const errorScreen = await render(
      <ReviewReportReceiptSheet
        sheetRef={sheetRef}
        reviewId={74}
        isOpen
        onDismiss={jest.fn()}
      />,
    );
    await act(async () => {
      fireEvent.press(errorScreen.getByText("Retry"));
    });
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    await act(async () => {
      errorScreen.unmount();
    });
  });
});
