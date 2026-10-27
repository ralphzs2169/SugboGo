import Toast from "react-native-toast-message";
import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import CreateReviewDisputeScreen from "../CreateReviewDisputeScreen";

const mockCreate = jest.fn();
const mockSelectedReview = jest.fn();
const mockPickImages = jest.fn();
const mockPickDocuments = jest.fn();
const mockEvidence = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockReasonProps: any;
let mockPrevent: any;
jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useNavigation: () => ({
    setOptions: jest.fn(),
    dispatch: jest.fn(),
    isFocused: () => true,
  }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: (_enabled: boolean, callback: unknown) => {
    mockPrevent = callback;
  },
}));
jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({ HeaderBackButton: () => null }),
);
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => ({ business: { id: 1 } }),
}));
jest.mock("../../../hooks/review-management/useMerchantReviewDetail", () => ({
  __esModule: true,
  default: () => mockSelectedReview(),
}));
jest.mock("../../../hooks/review-disputes/useReviewDisputes", () => ({
  useCreateReviewDispute: () => ({ mutateAsync: mockCreate, isPending: false }),
  useAddReviewDisputeEvidence: () => ({
    mutateAsync: mockEvidence,
    isPending: false,
  }),
}));
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 8,
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("@/shared/components/bottom-sheets/SelectionBottomSheet", () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockReasonProps = props;
    return null;
  },
}));
jest.mock(
  "../../../utils/review-disputes/pickReviewDisputeEvidence.utils",
  () => ({
    pickReviewDisputeImages: (...args: unknown[]) => mockPickImages(...args),
    pickReviewDisputeDocuments: (...args: unknown[]) =>
      mockPickDocuments(...args),
  }),
);
jest.mock(
  "../../../components/review-disputes/create-dispute-screen/CreateReviewDisputeFormContent",
  () => {
    const { View, Pressable, Text, TextInput } =
      jest.requireActual("react-native");
    return {
      __esModule: true,
      default: (props: any) => (
        <View>
          <TextInput
            accessibilityLabel="Details"
            value={props.description}
            editable={!props.isSubmitting}
            onChangeText={props.onDescriptionChange}
          />
          <Pressable onPress={props.onPickImages} disabled={props.isSubmitting}>
            <Text>Add evidence</Text>
          </Pressable>
          <Pressable
            onPress={props.onPickDocuments}
            disabled={props.isSubmitting}
          >
            <Text>Add document</Text>
          </Pressable>
          <Text>{props.evidence.length} attachments</Text>
        </View>
      ),
    };
  },
);
jest.mock(
  "../../../components/review-disputes/create-dispute-screen/CreateReviewDisputeFooter",
  () => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return {
      __esModule: true,
      default: ({ isSubmitting, onSubmit }: any) => (
        <Pressable disabled={isSubmitting} onPress={onSubmit}>
          <Text>Submit</Text>
        </Pressable>
      ),
    };
  },
);
jest.mock("@/shared/components/modals/ConfirmModal", () => {
  const { View, Text, Pressable } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: ({ visible, onConfirm, onCancel }: any) =>
      visible ? (
        <View>
          <Pressable onPress={onCancel}>
            <Text>Keep Editing</Text>
          </Pressable>
          <Pressable onPress={onConfirm}>
            <Text>Discard</Text>
          </Pressable>
        </View>
      ) : null,
  };
});

describe("Create Review Dispute reliability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSelectedReview.mockReturnValue({
      review: { id: 7 },
      refetch: jest.fn(),
    });
    mockPickImages.mockReset().mockResolvedValue([
      {
        uri: "file:///evidence.jpg",
        fileName: "evidence.jpg",
        mimeType: "image/jpeg",
      },
    ]);
    mockPickDocuments.mockReset().mockResolvedValue([]);
  });

  it("keeps the draft during a cached review refresh failure and retries only that section", async () => {
    const refetch = jest.fn();
    const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
    await fireEvent.changeText(
      screen.getByLabelText("Details"),
      "A preserved draft",
    );
    mockSelectedReview.mockReturnValue({
      review: { id: 7 },
      error: { code: "NETWORK_ERROR" },
      refetch,
    });
    await screen.rerender(<CreateReviewDisputeScreen reviewId={7} />);
    expect(screen.getByDisplayValue("A preserved draft")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: /Unable to refresh review.*retry/i }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    mockSelectedReview.mockReturnValue({ review: { id: 7 }, refetch });
    await screen.rerender(<CreateReviewDisputeScreen reviewId={7} />);
    expect(screen.queryByText("Unable to refresh review")).toBeNull();
  });

  it.each(["NOT_FOUND", "PERMISSION_DENIED"])(
    "hides a cached review after %s",
    async (code) => {
      mockSelectedReview.mockReturnValue({
        review: { id: 7 },
        error: { code },
        refetch: jest.fn(),
      });
      const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
      expect(screen.getByText("Unable to open this review")).toBeTruthy();
      expect(screen.queryByLabelText("Details")).toBeNull();
    },
  );

  it.each(["image", "document"])(
    "retains the draft and existing evidence after %s picker failure, then permits retry",
    async (kind) => {
      const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
      await fireEvent.changeText(
        screen.getByLabelText("Details"),
        "My dispute draft",
      );
      await fireEvent.press(screen.getByText("Add evidence"));
      const picker = kind === "image" ? mockPickImages : mockPickDocuments;
      picker.mockRejectedValueOnce(new Error("Native picker failure"));
      await fireEvent.press(
        screen.getByText(kind === "image" ? "Add evidence" : "Add document"),
      );
      expect(screen.getByDisplayValue("My dispute draft")).toBeTruthy();
      expect(screen.getByText("1 attachments")).toBeTruthy();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ text1: `Unable to attach ${kind}` }),
      );
      picker.mockResolvedValueOnce([
        {
          uri: "file:///another.jpg",
          fileName: "another.jpg",
          mimeType: "image/jpeg",
        },
      ]);
      await fireEvent.press(
        screen.getByText(kind === "image" ? "Add evidence" : "Add document"),
      );
      expect(screen.getByText("2 attachments")).toBeTruthy();
    },
  );

  it("protects selected reason and keeps the draft when discard is cancelled", async () => {
    const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
    await act(() => mockReasonProps.onSelect("spam"));
    await act(() => mockPrevent({ data: { action: { type: "POP" } } }));
    await fireEvent.press(screen.getByText("Keep Editing"));
    expect(mockBack).not.toHaveBeenCalled();
    await act(() => mockPrevent({ data: { action: { type: "POP" } } }));
    expect(screen.getByText("Discard")).toBeTruthy();
  });

  it("locks the complete create-and-evidence operation and navigates exactly once", async () => {
    let created: (value: unknown) => void = () => {};
    let uploaded: () => void = () => {};
    mockCreate.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          created = resolve;
        }),
    );
    mockEvidence.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          uploaded = resolve;
        }),
    );
    const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
    await act(() => mockReasonProps.onSelect("spam"));
    await fireEvent.changeText(
      screen.getByLabelText("Details"),
      "Please investigate this review.",
    );
    await fireEvent.press(screen.getByText("Add evidence"));
    await fireEvent.press(screen.getByText("Submit"));
    await fireEvent.press(screen.getByText("Submit"));
    await act(() => mockPrevent({ data: { action: { type: "POP" } } }));
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Details").props.editable).toBe(false);
    expect(screen.queryByText("Discard")).toBeNull();
    await act(() => created({ id: 9 }));
    await waitFor(() => expect(mockEvidence).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText("Details").props.editable).toBe(false);
    expect(mockReplace).not.toHaveBeenCalled();
    await act(() => uploaded());
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it("retains a failed submission and re-enables editing", async () => {
    mockCreate.mockRejectedValueOnce({ success: false, message: "Offline" });
    const screen = await render(<CreateReviewDisputeScreen reviewId={7} />);
    await act(() => mockReasonProps.onSelect("spam"));
    await fireEvent.changeText(
      screen.getByLabelText("Details"),
      "Keep this explanation.",
    );
    await fireEvent.press(screen.getByText("Submit"));
    await waitFor(() =>
      expect(screen.getByLabelText("Details").props.editable).toBe(true),
    );
    expect(screen.getByDisplayValue("Keep this explanation.")).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
