import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { BackHandler } from "react-native";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import type { User } from "@/features/users/types/user.types";
import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { businessReviewFixture } from "../../../__tests__/review.fixtures";
import {
  createReview,
  updateReview,
} from "../../../api/reviewBusiness.service";
import { useReviewWorkflowStore } from "../../../stores/reviewWorkflow.store";
import type {
  LocalReviewPhoto,
  ReviewCreateResult,
} from "../../../types/review.types";
import ReviewComposerSheet, {
  type EditableReview,
} from "../ReviewComposerSheet";

type SheetProps = ComponentProps<typeof BottomSheetModal>;
let mockSheetProps: SheetProps;
let mockHardwareBack: () => boolean | null | undefined;
const mockNativeDismiss = jest.fn();

jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual<typeof import("react")>("react");
  const { View, Pressable, TextInput } = jest.requireActual("react-native");
  return {
    BottomSheetScrollView: View,
    BottomSheetTextInput: TextInput,
    BottomSheetBackdrop: ({ onPress }: { onPress: () => void }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Review backdrop"
        onPress={onPress}
      />
    ),
    BottomSheetModal: ({
      ref,
      ...props
    }: SheetProps & { ref: React.Ref<unknown> }) => {
      const [visible, setVisible] = React.useState(false);
      mockSheetProps = props;
      React.useImperativeHandle(ref, () => ({
        present: () => {
          setVisible(true);
          props.onChange?.(0, 0, 0);
        },
        dismiss: () => {
          mockNativeDismiss(props.enableDismissOnClose);
          props.onAnimate?.(0, -1, 0, 900);
          props.onChange?.(-1, 900, 0);
          if (props.enableDismissOnClose !== false) {
            setVisible(false);
            props.onDismiss?.();
          }
        },
        snapToPosition: jest.fn(),
        snapToIndex: jest.fn(),
        expand: jest.fn(),
        collapse: jest.fn(),
      }));
      return visible ? (
        <View>
          {props.backdropComponent?.({} as never)}
          {props.children}
        </View>
      ) : null;
    },
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("../../../api/reviewBusiness.service", () => ({
  createReview: jest.fn(),
  updateReview: jest.fn(),
}));
jest.mock("../../../hooks/ReviewDerivedDataSyncProvider", () => ({
  useReviewDerivedDataSyncActions: () => ({
    observeReviewSubmission: jest.fn(),
    startSentimentSync: jest.fn(),
    startGeneratedInsightsSync: jest.fn(),
  }),
}));
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({ pickBusinessPhotos: jest.fn() }),
);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPreview",
  () => {
    const { Pressable } = jest.requireActual("react-native");
    return function MockPhotoPreview({
      uri,
      onRemove,
    }: {
      uri: string;
      onRemove?: () => void;
    }) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${uri}`}
          onPress={onRemove}
          disabled={!onRemove}
        />
      );
    };
  },
);

const original = businessReviewFixture({
  id: 8,
  text: "A lovely visit with welcoming staff and great coffee.",
  show_in_community: true,
  author: { id: 10, first_name: "Ana", last_name: "Cruz", avatar_url: null },
  photos: [{ id: 12, photo_url: "https://example.com/original.jpg" }],
});
const changedText =
  "An updated visit with even more friendly service and good coffee.";
const localPhoto: LocalReviewPhoto = {
  uri: "file:///new-photo.jpg",
  fileName: "new-photo.jpg",
  mimeType: "image/jpeg",
};
const received: ReviewCreateResult = {
  id: 18,
  business_id: 20,
  user_id: 10,
  status: "under_review",
  moderation_progress: { state: "pending" },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("shared review composer dismissal and completion", () => {
  let client: QueryClient;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(createReview).mockReset();
    jest.mocked(updateReview).mockReset();
    jest.mocked(pickBusinessPhotos).mockReset();
    beginAuthSession();
    useAuthStore.setState({
      user: { id: 10, first_name: "Ana", last_name: "Cruz" } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    jest.mocked(pickBusinessPhotos).mockResolvedValue([localPhoto]);
    jest.mocked(createReview).mockResolvedValue({
      success: true,
      message: "Received",
      data: received,
    });
    jest
      .mocked(updateReview)
      .mockResolvedValue({ success: true, message: "Saved", data: original });
    jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, callback) => {
        mockHardwareBack = () => callback({} as never);
        return { remove: jest.fn() };
      });
  });
  afterEach(() => {
    client.clear();
    jest.restoreAllMocks();
  });

  async function open(review?: EditableReview) {
    const ref = { current: null as BottomSheetModal | null };
    const onDismiss = jest.fn();
    const screen = await render(
      <QueryClientProvider client={client}>
        <ReviewComposerSheet
          businessId={20}
          businessName="Sugbo Cafe"
          sheetRef={ref}
          review={review}
          onDismiss={onDismiss}
        />
      </QueryClientProvider>,
    );
    await act(async () => ref.current?.present());
    return { screen, ref, onDismiss };
  }

  async function gestureClose() {
    await act(async () => {
      mockSheetProps.onAnimate?.(0, -1, 0, 900);
      mockSheetProps.onChange?.(-1, 900, 0);
    });
  }

  it.each([undefined, original])(
    "closes an unchanged composer immediately",
    async (review) => {
      const { screen, onDismiss } = await open(review);
      await fireEvent.press(screen.getByRole("button", { name: "Close" }));
      expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
      expect(mockNativeDismiss).toHaveBeenCalledWith(true);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(screen.queryByText("Discard review changes?")).toBeNull();
    },
  );

  it.each([
    "Close",
    "backdrop",
    "pan down",
    "Android Back",
    "dismiss",
    "close",
    "forceClose",
    "snapToIndex",
  ])(
    "protects dirty edits through %s and preserves text/photos until discard",
    async (path) => {
      const { screen, ref, onDismiss } = await open(original);
      await fireEvent.changeText(
        screen.getByDisplayValue(original.text),
        changedText,
      );
      await fireEvent.press(
        screen.getByRole("button", { name: "Add review photo" }),
      );
      if (path === "Close" || path === "backdrop") {
        await fireEvent.press(
          screen.getByRole("button", {
            name: path === "Close" ? "Close" : "Review backdrop",
          }),
        );
      } else if (path === "pan down") {
        expect(mockSheetProps.enableDismissOnClose).toBe(false);
        await gestureClose();
      } else {
        await act(async () => {
          if (path === "Android Back") {
            expect(mockHardwareBack()).toBe(true);
          } else if (path === "snapToIndex") {
            ref.current?.snapToIndex(-1);
          } else {
            ref.current?.[path as "dismiss" | "close" | "forceClose"]();
          }
        });
      }
      expect(screen.getByText("Discard review changes?")).toBeTruthy();
      expect(mockNativeDismiss).not.toHaveBeenCalled();
      await fireEvent.press(
        screen.getByRole("button", { name: "Keep editing" }),
      );
      expect(screen.getByDisplayValue(changedText)).toBeTruthy();
      expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
      expect(
        screen.getByLabelText(`Remove ${original.photos[0].photo_url}`),
      ).toBeTruthy();
      await fireEvent.press(screen.getByRole("button", { name: "Close" }));
      await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
      expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(updateReview).not.toHaveBeenCalled();
      await act(async () => ref.current?.present());
      expect(screen.getByDisplayValue(original.text)).toBeTruthy();
      expect(screen.queryByLabelText(`Remove ${localPhoto.uri}`)).toBeNull();
      expect(
        screen.getByLabelText(`Remove ${original.photos[0].photo_url}`),
      ).toBeTruthy();
    },
  );

  it.each(["add", "remove", "replace", "community"])(
    "detects a meaningful %s change without requiring a text change",
    async (change) => {
      const { screen } = await open(original);
      if (change === "remove" || change === "replace") {
        await fireEvent.press(
          screen.getByLabelText(`Remove ${original.photos[0].photo_url}`),
        );
      }
      if (change === "add" || change === "replace") {
        await fireEvent.press(
          screen.getByRole("button", { name: "Add review photo" }),
        );
      }
      if (change === "community") {
        await fireEvent(screen.getByRole("switch"), "valueChange", false);
      }
      await fireEvent.press(screen.getByRole("button", { name: "Close" }));
      expect(screen.getByText("Discard review changes?")).toBeTruthy();
      expect(mockNativeDismiss).not.toHaveBeenCalled();
    },
  );

  it("protects unsubmitted new text and photos, then clears them on discard", async () => {
    const { screen, ref } = await open();
    await fireEvent.changeText(
      screen.getByPlaceholderText("What stood out about your visit?"),
      changedText,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    await act(async () => ref.current?.present());
    expect(
      screen.getByPlaceholderText("What stood out about your visit?").props
        .value,
    ).toBe("");
    expect(screen.queryByLabelText(`Remove ${localPhoto.uri}`)).toBeNull();
  });

  describe.each(["published", "under_review"] as const)(
    "accepted %s creation",
    (status) => {
      it.each([0, 1, 3])(
        "closes exactly once with %s photos even while follow-up invalidation is pending",
        async (count) => {
          const request = deferred<Awaited<ReturnType<typeof createReview>>>();
          const refresh = deferred<void>();
          jest.mocked(createReview).mockReturnValueOnce(request.promise);
          jest
            .spyOn(client, "invalidateQueries")
            .mockReturnValueOnce(refresh.promise);
          const { screen, ref, onDismiss } = await open();
          await fireEvent.changeText(
            screen.getByPlaceholderText("What stood out about your visit?"),
            changedText,
          );
          const selected = Array.from({ length: count }, (_, index) => ({
            ...localPhoto,
            uri: `file:///photo-${index}.jpg`,
          }));
          if (count > 0) {
            jest.mocked(pickBusinessPhotos).mockResolvedValueOnce(selected);
            await fireEvent.press(
              screen.getByRole("button", { name: "Add review photo" }),
            );
          }
          await fireEvent.press(
            screen.getByRole("button", { name: "Submit review" }),
          );
          await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
          expect(mockNativeDismiss).not.toHaveBeenCalled();
          await act(async () =>
            request.resolve({
              success: true,
              message: "Received",
              data: { ...received, status },
            }),
          );
          await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
          expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
          expect(screen.queryByText("Discard review changes?")).toBeNull();
          await act(async () => refresh.resolve());
          expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
          expect(Toast.show).toHaveBeenCalledTimes(1);
          expect(createReview).toHaveBeenCalledWith(
            20,
            changedText,
            selected,
            true,
          );
          await act(async () => ref.current?.present());
          expect(
            screen.getByPlaceholderText("What stood out about your visit?")
              .props.value,
          ).toBe("");
          selected.forEach((photo) =>
            expect(screen.queryByLabelText(`Remove ${photo.uri}`)).toBeNull(),
          );
        },
      );
    },
  );

  it("keeps a failed photo submission retryable and only closes after acceptance", async () => {
    jest.mocked(createReview).mockResolvedValueOnce({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Please revise this review",
    });
    const { screen } = await open();
    await fireEvent.changeText(
      screen.getByPlaceholderText("What stood out about your visit?"),
      changedText,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit review" }),
    );
    await waitFor(() =>
      expect(useReviewWorkflowStore.getState().submissions[0]?.state).toBe(
        "failed",
      ),
    );
    expect(mockNativeDismiss).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit review" }),
    );
    await waitFor(() => expect(mockNativeDismiss).toHaveBeenCalledTimes(1));
    expect(createReview).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Discard review changes?")).toBeNull();
  });

  it("keeps uncertain photo submission recovery while protecting newer unsent edits", async () => {
    jest.mocked(createReview).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Connection lost",
    });
    const { screen, ref } = await open();
    await fireEvent.changeText(
      screen.getByPlaceholderText("What stood out about your visit?"),
      changedText,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit review" }),
    );
    await waitFor(() =>
      expect(useReviewWorkflowStore.getState().submissions[0]?.state).toBe(
        "confirming",
      ),
    );
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
    expect(useReviewWorkflowStore.getState().submissions[0]?.photos).toEqual([
      localPhoto,
    ]);
    await act(async () => ref.current?.present());
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
    expect(createReview).toHaveBeenCalledTimes(1);
    const unsentText = `${changedText} Another unsent detail.`;
    await fireEvent.changeText(
      screen.getByDisplayValue(changedText),
      unsentText,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByText("Discard review changes?")).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByDisplayValue(unsentText)).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await fireEvent.press(screen.getByRole("button", { name: "Discard" }));
    expect(useReviewWorkflowStore.getState().submissions[0]?.state).toBe(
      "confirming",
    );
    await act(async () => ref.current?.present());
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
  });

  it("blocks dismissal during an edit, retains rejection, then saves the persisted photo baseline", async () => {
    const request = deferred<Awaited<ReturnType<typeof updateReview>>>();
    jest.mocked(updateReview).mockReturnValueOnce(request.promise);
    const { screen, ref, onDismiss } = await open(original);
    await fireEvent.changeText(
      screen.getByDisplayValue(original.text),
      changedText,
    );
    await fireEvent.press(
      screen.getByLabelText(`Remove ${original.photos[0].photo_url}`),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateReview).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await act(async () => {
      ref.current?.dismiss();
      expect(mockHardwareBack()).toBe(true);
    });
    expect(mockSheetProps.enablePanDownToClose).toBe(false);
    expect(mockNativeDismiss).not.toHaveBeenCalled();
    expect(screen.queryByText("Discard review changes?")).toBeNull();
    await act(async () =>
      request.resolve({
        success: false,
        code: "REVIEW_EDIT_CONTENT_FLAGGED",
        message: "Blocked",
      }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy(),
    );
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByLabelText(`Remove ${localPhoto.uri}`)).toBeTruthy();
    const updated = {
      ...original,
      text: changedText,
      photos: [{ id: 30, photo_url: "https://example.com/persisted.jpg" }],
    };
    jest.mocked(updateReview).mockResolvedValueOnce({
      success: true,
      message: "Saved",
      data: updated,
    });
    await fireEvent.press(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Discard review changes?")).toBeNull();
    await act(async () => ref.current?.present());
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(
      screen.getByLabelText("Remove https://example.com/persisted.jpg"),
    ).toBeTruthy();
    expect(screen.queryByLabelText(`Remove ${localPhoto.uri}`)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(mockNativeDismiss).toHaveBeenCalledTimes(2);
  });

  it("allows a new submission to finish hidden without another dismissal", async () => {
    const request = deferred<Awaited<ReturnType<typeof createReview>>>();
    jest.mocked(createReview).mockReturnValueOnce(request.promise);
    const { screen } = await open();
    await fireEvent.changeText(
      screen.getByPlaceholderText("What stood out about your visit?"),
      changedText,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Submit review" }),
    );
    await waitFor(() => expect(createReview).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
    expect(useReviewWorkflowStore.getState().submissions[0]?.photos).toEqual([
      localPhoto,
    ]);
    await act(async () =>
      request.resolve({ success: true, message: "Received", data: received }),
    );
    await waitFor(() =>
      expect(useReviewWorkflowStore.getState().submissions[0]?.state).toBe(
        "acknowledged",
      ),
    );
    expect(mockNativeDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not reattach delayed picker photos after dismissal or a session change", async () => {
    const picker = deferred<LocalReviewPhoto[]>();
    jest.mocked(pickBusinessPhotos).mockReturnValueOnce(picker.promise);
    const { screen, ref } = await open();
    const choosing = fireEvent.press(
      screen.getByRole("button", { name: "Add review photo" }),
    );
    await waitFor(() => expect(pickBusinessPhotos).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await act(async () => {
      invalidateAuthSession();
      beginAuthSession();
      useAuthStore.getState().setUser({ id: 11 } as User);
      ref.current?.present();
      picker.resolve([localPhoto]);
    });
    await choosing;
    expect(screen.queryByLabelText(`Remove ${localPhoto.uri}`)).toBeNull();
    expect(
      screen.getByPlaceholderText("What stood out about your visit?").props
        .value,
    ).toBe("");
  });
});
