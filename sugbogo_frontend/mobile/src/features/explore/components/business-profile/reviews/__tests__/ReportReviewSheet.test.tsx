import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import type { RefObject } from "react";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";

import ReportReviewSheet from "../ReportReviewSheet";

const mockReportReview = jest.fn();
const mockDismiss = jest.fn();
let mockIsPending = false;

jest.mock("../../../../hooks/useBusinessReviews", () => ({
  useReportReview: () => ({
    mutateAsync: mockReportReview,
    isPending: mockIsPending,
  }),
}));
jest.mock("@gorhom/bottom-sheet", () => {
  const React = require("react");
  const { TextInput, View } = require("react-native");
  const MockBottomSheetModal = React.forwardRef(
    (props: { children: React.ReactNode }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({ dismiss: mockDismiss }));
      return <View>{props.children}</View>;
    },
  );
  MockBottomSheetModal.displayName = "MockBottomSheetModal";
  return {
    BottomSheetModal: MockBottomSheetModal,
    BottomSheetScrollView: View,
    BottomSheetBackdrop: View,
    BottomSheetTextInput: TextInput,
  };
});
jest.mock("@/shared/components/form/FormTextArea", () => ({
  __esModule: true,
  default: ({ label, value, onChangeText, maxLength, error, rightElement }: {
    label: string;
    value: string;
    onChangeText: (value: string) => void;
    maxLength: number;
    error?: string;
    rightElement: React.ReactNode;
  }) => {
    const { Text, TextInput, View } = require("react-native");
    return (
      <View>
        <Text>{label}</Text>
        <TextInput
          accessibilityLabel="Additional details"
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
        />
        {rightElement}
        {error && <Text>{error}</Text>}
      </View>
    );
  },
}));
jest.mock("@/shared/components/Button", () => ({
  __esModule: true,
  default: ({ title, onPress, disabled, loading }: {
    title: string;
    onPress: () => void;
    disabled?: boolean;
    loading?: boolean;
  }) => {
    const { Pressable, Text } = require("react-native");
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled || loading}
        onPress={onPress}
      >
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));

const sheetRef = {
  current: null,
} as RefObject<BottomSheetModal | null>;

function renderSheet() {
  return render(
    <ReportReviewSheet sheetRef={sheetRef} businessId={20} reviewId={74} />,
  );
}

async function selectReason(screen: Awaited<ReturnType<typeof renderSheet>>, label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole("radio", { name: label }));
  });
}

async function enterDetails(screen: Awaited<ReturnType<typeof renderSheet>>, value: string) {
  await act(async () => {
    fireEvent.changeText(screen.getByLabelText("Additional details"), value);
  });
}

async function submit(screen: Awaited<ReturnType<typeof renderSheet>>) {
  await act(async () => {
    fireEvent.press(screen.getByText("Submit Report"));
  });
}

describe("ReportReviewSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsPending = false;
    mockReportReview.mockResolvedValue({ success: true });
  });

  it("shows six reasons without submitting when a reason is selected", async () => {
    const screen = await renderSheet();

    for (const label of [
      "Spam",
      "Abuse or Harassment",
      "False or Misleading Information",
      "Off-topic or Irrelevant",
      "Personal or Private Information",
      "Other",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    await selectReason(screen, "Spam");
    expect(mockReportReview).not.toHaveBeenCalled();
    expect(screen.getByText("Additional details (Optional)")).toBeTruthy();
    expect(screen.getByText("0/500")).toBeTruthy();
    screen.unmount();
  });

  it("requires details for Other and preserves text when changing reasons", async () => {
    const screen = await renderSheet();
    await selectReason(screen, "Other");
    expect(screen.getByText("Additional details (Required)")).toBeTruthy();
    expect(screen.getByText("Please explain why you are reporting this review.")).toBeTruthy();
    await enterDetails(screen, "   ");
    expect(screen.getByText("Please explain why you are reporting this review.")).toBeTruthy();
    await enterDetails(screen, "Details to keep");
    await selectReason(screen, "Spam");
    expect(screen.getByLabelText("Additional details").props.value).toBe("Details to keep");
    screen.unmount();
  });

  it("caps details at 500 characters and submits trimmed details explicitly", async () => {
    const screen = await renderSheet();
    await selectReason(screen, "Other");
    await enterDetails(screen, `  ${"x".repeat(500)}`);
    expect(screen.getByText("500/500")).toBeTruthy();
    expect(screen.getByLabelText("Additional details").props.maxLength).toBe(500);

    await enterDetails(screen, "  This is concerning.  ");
    await submit(screen);
    await waitFor(() => expect(mockReportReview).toHaveBeenCalledWith({
      reviewId: 74,
      reportType: "other",
      explanation: "This is concerning.",
    }));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      text1: "Review reported",
    }));
    screen.unmount();
  });

  it("allows a preset reason with no explanation", async () => {
    const screen = await renderSheet();
    await selectReason(screen, "Off-topic or Irrelevant");
    await submit(screen);
    await waitFor(() => expect(mockReportReview).toHaveBeenCalledWith({
      reviewId: 74,
      reportType: "off_topic",
      explanation: undefined,
    }));
    screen.unmount();
  });

  it("keeps form values and inline feedback after an API error", async () => {
    mockReportReview.mockRejectedValue({
      success: false,
      message: "You have already reported this review.",
    });
    const screen = await renderSheet();
    await selectReason(screen, "Spam");
    await enterDetails(screen, "My context");
    await submit(screen);

    await waitFor(() => expect(screen.getByText("You have already reported this review.")).toBeTruthy());
    expect(screen.getByLabelText("Additional details").props.value).toBe("My context");
    expect(mockDismiss).not.toHaveBeenCalled();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({
      type: "error",
    }));
    screen.unmount();
  });

  it("disables submission while the report mutation is pending", async () => {
    const screen = await renderSheet();
    await selectReason(screen, "Spam");
    mockIsPending = true;
    await act(async () => {
      screen.rerender(
        <ReportReviewSheet sheetRef={sheetRef} businessId={20} reviewId={74} />,
      );
    });
    await submit(screen);
    expect(mockReportReview).not.toHaveBeenCalled();
    expect(
      screen.getByText("Submit Report").parent?.props.accessibilityState.disabled,
    ).toBe(true);
    screen.unmount();
  });
});
