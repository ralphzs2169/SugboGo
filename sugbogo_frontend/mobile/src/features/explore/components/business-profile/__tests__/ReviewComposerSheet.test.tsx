import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";

import {
  useCreateReview,
  useUpdateReview,
} from "../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../types/review.types";
import ReviewComposerSheet from "../ReviewComposerSheet";

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, TextInput } = require("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetScrollView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetTextInput: TextInput,
  };
});
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({
    pickBusinessPhotos: jest.fn(),
  }),
);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPreview",
  () => ({
    __esModule: true,
    default: () => null,
  }),
);
jest.mock("@/shared/components/form/FormTextArea", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TextInput } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      value: string;
      onChangeText: (value: string) => void;
    }) => (
      <TextInput
        accessibilityLabel="Your review"
        value={props.value}
        onChangeText={props.onChangeText}
      />
    ),
  };
});
jest.mock("@/shared/components/Button", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Pressable, Text } = require("react-native");
  return {
    __esModule: true,
    default: (props: {
      title: string;
      onPress: () => void;
      disabled: boolean;
    }) => (
      <Pressable
        testID="review-submit-button"
        accessibilityRole="button"
        disabled={props.disabled}
        onPress={props.onPress}
      >
        <Text>{props.title}</Text>
      </Pressable>
    ),
  };
});
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("../../../hooks/useBusinessReviews", () => ({
  useCreateReview: jest.fn(),
  useUpdateReview: jest.fn(),
}));

const create = jest.fn();
const update = jest.fn();
const sheetRef = { current: { dismiss: jest.fn() } };
const review = {
  id: 8,
  text: "A lovely visit with friendly staff.",
  photos: [],
  show_in_community: false,
} as unknown as BusinessReview;

function showReview(existing?: BusinessReview) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <ReviewComposerSheet
        businessId={20}
        businessName="Sugbo Cafe"
        sheetRef={sheetRef as never}
        review={existing}
      />
    </SafeAreaProvider>,
  );
}

async function settleForm() {
  await act(async () => {});
}

describe("ReviewComposerSheet Community visibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    create.mockResolvedValue({ id: 9 });
    update.mockResolvedValue(review);
    (useCreateReview as jest.Mock).mockReturnValue({
      mutateAsync: create,
      isPending: false,
      error: null,
    });
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: update,
      isPending: false,
      error: null,
    });
  });

  it("defaults on and submits an explicit enabled preference", async () => {
    const screen = await showReview();
    await settleForm();
    expect(screen.getByRole("switch").props.value).toBe(true);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    expect(screen.getByLabelText("Your review").props.value).toBe(
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith({
        text: "A lovely visit with friendly staff.",
        photos: [],
        showInCommunity: true,
      }),
    );
  });

  it("submits the disabled creation preference", async () => {
    const screen = await showReview();
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ showInCommunity: false }),
      ),
    );
  });

  it("loads the saved value and permits a visibility-only edit", async () => {
    const screen = await showReview(review);
    await settleForm();
    expect(screen.getByRole("switch").props.value).toBe(false);
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        reviewId: 8,
        text: undefined,
        photos: [],
        keepPhotoIds: undefined,
        showInCommunity: true,
        textChanged: false,
      }),
    );
  });

  it("preserves the saved preference when editing only review text", async () => {
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A newer review with plenty of detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          text: "A newer review with plenty of detail.",
          showInCommunity: undefined,
          textChanged: true,
        }),
      ),
    );
  });

  it("can change visibility on a legacy short review without rewriting it", async () => {
    const shortReview = { ...review, text: "Older short review." };
    const screen = await showReview(shortReview);
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", true);
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          text: undefined,
          showInCommunity: true,
        }),
      ),
    );
  });

  it("keeps the chosen value and shows existing error feedback after failure", async () => {
    create.mockRejectedValue(new Error("Network unavailable"));
    const screen = await showReview();
    await settleForm();
    await fireEvent(screen.getByRole("switch"), "valueChange", false);
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A lovely visit with friendly staff.",
    );
    await fireEvent.press(screen.getByText("Submit review"));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("switch").props.value).toBe(false);
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
  });
});

describe("ReviewComposerSheet edit moderation feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    update.mockRejectedValue(new Error("Edit rejected"));
    (useCreateReview as jest.Mock).mockReturnValue({
      mutateAsync: create,
      isPending: false,
      error: null,
    });
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: update,
      isPending: false,
      error: null,
    });
  });

  it("closes with success feedback after an accepted edit", async () => {
    update.mockResolvedValue(review);
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "An accepted update with enough written detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", text1: "Review updated" }),
      ),
    );
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("review-edit-error-banner")).toBeNull();
  });

  it.each([
    [
      "REVIEW_EDIT_CONTENT_FLAGGED",
      "Changes not saved",
      "Your updated review didn't pass our content safety check. Please revise your changes and try again.",
    ],
    [
      "REVIEW_EDIT_MODERATION_UNAVAILABLE",
      "Couldn't check your changes",
      "We couldn't complete the content check right now. Your original review is unchanged. Please try again later.",
    ],
    [
      "REVIEW_EDIT_CONFLICT",
      "Review changed",
      "This review was updated while you were editing. Please reload it before making changes.",
    ],
  ])("preserves the draft after %s", async (code, title, message) => {
    update.mockRejectedValue({ success: false, code, message });
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A changed review with enough written detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy(),
    );
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
    expect(screen.getByLabelText("Your review").props.value).toBe(
      "A changed review with enough written detail.",
    );
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("preserves selected photos after a blocked edit", async () => {
    update.mockRejectedValue({
      success: false,
      code: "REVIEW_EDIT_CONTENT_FLAGGED",
      message: "Blocked",
    });
    (pickBusinessPhotos as jest.Mock).mockResolvedValue([
      { uri: "file:///proposed.jpg", name: "proposed.jpg", type: "image/jpeg" },
    ]);
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.press(screen.getByLabelText("Add review photo"));
    await waitFor(() => expect(screen.getByText("1/3")).toBeTruthy());
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy(),
    );
    await waitFor(() => expect(screen.getByText("1/3")).toBeTruthy());
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Add review photo"));
    expect(screen.queryByTestId("review-edit-error-banner")).toBeNull();
  });

  it("clears the banner as soon as the user retries", async () => {
    let resolveRetry: ((value: BusinessReview) => void) | undefined;
    update.mockRejectedValueOnce({
      success: false,
      code: "REVIEW_EDIT_MODERATION_UNAVAILABLE",
      message: "Unavailable",
    });
    update.mockImplementationOnce(
      () =>
        new Promise<BusinessReview>((resolve) => {
          resolveRetry = resolve;
        }),
    );
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A proposed review with enough written detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy(),
    );

    const retryPress = fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("review-edit-error-banner")).toBeNull();
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();

    await act(async () => {
      resolveRetry?.(review);
    });
    await retryPress;
    await waitFor(() =>
      expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1),
    );
  });

  it("clears the banner when the review changes and when retried", async () => {
    update.mockRejectedValueOnce({
      success: false,
      code: "REVIEW_EDIT_CONTENT_FLAGGED",
      message: "Blocked",
    });
    update.mockResolvedValueOnce(review);
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A proposed review with enough written detail.",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() =>
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy(),
    );

    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A revised review with enough written detail.",
    );
    expect(screen.queryByTestId("review-edit-error-banner")).toBeNull();
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId("review-edit-error-banner")).toBeNull();
    expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1);
  });

  it("disables submission while moderation is pending", async () => {
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: update,
      isPending: true,
      error: null,
    });
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A changed review with enough written detail.",
    );
    await fireEvent.press(screen.getByTestId("review-submit-button"));
    expect(update).not.toHaveBeenCalled();
  });
});
