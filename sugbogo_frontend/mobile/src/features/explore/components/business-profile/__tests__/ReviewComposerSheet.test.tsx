import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";

import {
  useCreateReview,
  useUpdateReview,
} from "../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../types/review.types";
import ReviewComposerSheet from "../ReviewComposerSheet";
import {
  useReviewWorkflowStore,
  type ReviewSubmissionDraft,
} from "../../../stores/reviewWorkflow.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";

let mockSubmitHandler: () => void;
let mockSheetChange: (index: number) => void;

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View, TextInput } = require("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: ({
      children,
      onChange,
    }: {
      children: React.ReactNode;
      onChange: (index: number) => void;
    }) => {
      mockSheetChange = onChange;
      return <View>{children}</View>;
    },
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
  () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pressable } = require("react-native");
    return {
      __esModule: true,
      default: ({ uri, onRemove }: { uri: string; onRemove?: () => void }) => (
        <Pressable accessibilityLabel={`Remove ${uri}`} onPress={onRemove} />
      ),
    };
  },
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
    }) => {
      mockSubmitHandler = props.onPress;
      return (
        <Pressable
          testID="review-submit-button"
          accessibilityRole="button"
          disabled={props.disabled}
          onPress={props.onPress}
        >
          <Text>{props.title}</Text>
        </Pressable>
      );
    },
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
  afterEach(async () => {
    await act(async () => {
      useReviewWorkflowStore.setState({ submissions: [] });
    });
  });

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

  it("shows submitting feedback and allows closing a new submission", async () => {
    (useCreateReview as jest.Mock).mockReturnValue({
      mutateAsync: create,
      isPending: true,
      error: null,
    });
    const screen = await showReview();
    expect(screen.getByText("Submitting · Only you can see this")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(sheetRef.current.dismiss).toHaveBeenCalled();
  });

  it.each<ReviewSubmissionDraft["state"]>([
    "acknowledged",
    "confirming",
    "unconfirmed",
    "failed",
  ])(
    "only auto-dismisses confirmed receipt while refreshes are pending: %s",
    async (state) => {
      useAuthStore.setState({
        user: { id: 10 } as never,
        isAuthenticated: true,
      });
      (useCreateReview as jest.Mock).mockReturnValue({
        mutateAsync: create,
        isPending: true,
        error: null,
      });
      const screen = await showReview();
      await act(async () => mockSheetChange(0));
      await act(async () => {
        useReviewWorkflowStore.setState({
          submissions: [
            {
              token: 100,
              userId: 10,
              generation: getAuthSessionGeneration(),
              businessId: 20,
              businessName: "Sugbo Cafe",
              text: "A lovely visit with friendly staff.",
              showInCommunity: true,
              photos: [],
              author: {
                id: 10,
                first_name: "Ana",
                last_name: "Cruz",
                avatar_url: null,
              },
              createdAt: new Date().toISOString(),
              state,
              ...(state === "acknowledged"
                ? {
                    result: {
                      id: 9,
                      business_id: 20,
                      user_id: 10,
                      status: "under_review" as const,
                      moderation_progress: { state: "pending" as const },
                    },
                  }
                : {}),
            },
          ],
        });
      });
      expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(
        state === "acknowledged" ? 1 : 0,
      );
      expect(
        screen.queryByText("Review received. You can close this screen."),
      ).toBeNull();
      await act(async () =>
        useAuthStore.setState({ user: null, isAuthenticated: false }),
      );
    },
  );

  it("shows saving feedback while retaining proposed edit content", async () => {
    (useUpdateReview as jest.Mock).mockReturnValue({
      mutateAsync: update,
      isPending: true,
      error: null,
    });
    const screen = await showReview(review);
    expect(screen.getByText("Saving changes…")).toBeTruthy();
    expect(screen.getByDisplayValue(review.text)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
  });

  it("clears an open private edit when the account changes", async () => {
    await act(async () => useAuthStore.setState({ user: { id: 10 } as never }));
    const screen = await showReview({ ...review, author: { id: 10 } } as never);
    expect(screen.getByDisplayValue(review.text)).toBeTruthy();
    await act(async () => useAuthStore.setState({ user: { id: 99 } as never }));
    expect(screen.queryByDisplayValue(review.text)).toBeNull();
    expect(screen.getByLabelText("Your review").props.value).toBe("");
    await act(async () => useAuthStore.setState({ user: null }));
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
        businessName: "Sugbo Cafe",
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

describe("ReviewComposerSheet photo retention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it.each([1, 3])(
    "sends an empty retention list after removing %i photos",
    async (count) => {
      const photos = Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        photo_url: `https://example.com/existing-${index}.jpg`,
      }));
      const screen = await showReview({ ...review, photos });
      await settleForm();

      for (const photo of photos) {
        await fireEvent.press(
          screen.getByLabelText(`Remove ${photo.photo_url}`),
        );
      }
      await fireEvent.press(screen.getByText("Save changes"));

      await waitFor(() =>
        expect(update).toHaveBeenCalledWith(
          expect.objectContaining({
            keepPhotoIds: [],
            photos: [],
            text: undefined,
          }),
        ),
      );
    },
  );

  it("retains the draft and existing photos when the photo picker fails", async () => {
    const photo = { id: 12, photo_url: "https://example.com/original.jpg" };
    (pickBusinessPhotos as jest.Mock).mockRejectedValueOnce(
      new Error("Unable to prepare this image."),
    );
    const screen = await showReview({ ...review, photos: [photo] });
    await settleForm();
    await fireEvent.press(screen.getByLabelText("Add review photo"));
    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "error",
          text1: "Unable to add photos",
        }),
      ),
    );
    expect(screen.getByLabelText("Your review").props.value).toBe(review.text);
    expect(screen.getByLabelText(`Remove ${photo.photo_url}`)).toBeTruthy();
    expect(update).not.toHaveBeenCalled();
  });

  it("submits replacement photos with an empty retention list", async () => {
    const existing = { id: 12, photo_url: "https://example.com/original.jpg" };
    const replacement = { uri: "file:///replacement.jpg" };
    (pickBusinessPhotos as jest.Mock).mockResolvedValue([replacement]);
    const screen = await showReview({ ...review, photos: [existing] });
    await settleForm();
    await fireEvent.press(
      screen.getByLabelText(`Remove ${existing.photo_url}`),
    );
    await fireEvent.press(screen.getByLabelText("Add review photo"));
    await waitFor(() => expect(screen.getByText("1/3")).toBeTruthy());
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ keepPhotoIds: [], photos: [replacement] }),
      ),
    );
  });

  it("keeps only the remaining photo IDs when removing a subset", async () => {
    const photos = [
      { id: 12, photo_url: "https://example.com/one.jpg" },
      { id: 34, photo_url: "https://example.com/two.jpg" },
    ];
    const screen = await showReview({ ...review, photos });
    await settleForm();
    await fireEvent.press(
      screen.getByLabelText(`Remove ${photos[0].photo_url}`),
    );
    await fireEvent.press(screen.getByText("Save changes"));

    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ keepPhotoIds: [34], photos: [] }),
      ),
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

  it("does not dismiss another editor or show success feedback after unmounting", async () => {
    let finish!: (value: BusinessReview) => void;
    update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "An accepted change with enough useful detail.",
    );
    await act(async () => {
      mockSubmitHandler();
    });
    await screen.unmount();
    await act(async () => {
      finish(review);
    });
    expect(sheetRef.current.dismiss).not.toHaveBeenCalled();
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("prevents a second submission before mutation pending state rerenders", async () => {
    let finishUpdate!: (value: BusinessReview) => void;
    update.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUpdate = resolve;
        }),
    );
    const screen = await showReview(review);
    await settleForm();
    await fireEvent.changeText(
      screen.getByLabelText("Your review"),
      "A changed review with enough written detail.",
    );
    const submit = mockSubmitHandler;
    await act(async () => {
      submit();
      submit();
    });
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishUpdate(review);
    });
    await waitFor(() =>
      expect(sheetRef.current.dismiss).toHaveBeenCalledTimes(1),
    );
  });
});
