import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  updateReview,
  deleteReview,
  getBusinessReviewPreview,
} from "@/features/explore/api/reviewBusiness.service";
import { getExploreBusinessDetail } from "@/features/explore/api/exploreBusiness.service";
import {
  businessReviewsKey,
  businessReviewPreviewKey,
  exploreBusinessDetailKey,
} from "@/features/explore/hooks/reviewQueryKeys";
import { COMMUNITY_REVIEWS_QUERY_KEY } from "@/features/community/hooks/communityReviewQueryKeys";
import { DISCOVERY_FEED_QUERY_KEY } from "@/features/explore/hooks/useDiscoveryFeed";
import { pickBusinessPhotos } from "@/features/merchant/components/registration/business-photos/PhotoPicker";
import type { User } from "@/features/users/types/user.types";
import { getMyReviews } from "../../api/myReviews.service";
import { myReviewsKey } from "../../hooks/myReviewQueryKeys";
import type { MyReview } from "../../types/myReview.types";
import ReviewsSubmittedScreen from "../ReviewsSubmittedScreen";

jest.mock("../../api/myReviews.service", () => ({ getMyReviews: jest.fn() }));
jest.mock("@/features/explore/api/reviewBusiness.service", () => ({
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
  getBusinessReviewPreview: jest.fn(),
}));
jest.mock("@/features/explore/api/exploreBusiness.service", () => ({
  getExploreBusinessDetail: jest.fn(),
}));
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 24, left: 0, right: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({ Image: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: { show: jest.fn() },
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => () => null);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPicker",
  () => ({ pickBusinessPhotos: jest.fn() }),
);
jest.mock(
  "@/features/merchant/components/registration/business-photos/PhotoPreview",
  () => ({
    __esModule: true,
    default: ({ uri, onRemove }: { uri: string; onRemove?: () => void }) => {
      const { Pressable } = jest.requireActual("react-native");
      return (
        <Pressable accessibilityLabel={`Remove ${uri}`} onPress={onRemove} />
      );
    },
  }),
);
jest.mock("@gorhom/bottom-sheet", () => {
  const React = jest.requireActual("react");
  const { View, TextInput } = jest.requireActual("react-native");
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetScrollView: View,
    BottomSheetView: View,
    BottomSheetTextInput: TextInput,
    BottomSheetModal: ({
      children,
      ref,
      onChange,
      onDismiss,
    }: {
      children: React.ReactNode;
      ref: React.Ref<unknown>;
      onChange?: (index: number) => void;
      onDismiss?: () => void;
    }) => {
      const [visible, setVisible] = React.useState(false);
      React.useImperativeHandle(ref, () => ({
        present: () => {
          setVisible(true);
          onChange?.(0);
        },
        dismiss: () => {
          setVisible(false);
          onChange?.(-1);
          onDismiss?.();
        },
      }));
      return visible ? <View>{children}</View> : null;
    },
  };
});

const originalText = "A lovely visit with friendly staff and local coffee.";
const changedText =
  "An updated experience with welcoming staff and great coffee.";
const existingPhotos = [
  { id: 12, photo_url: "https://example.com/one.jpg" },
  { id: 34, photo_url: "https://example.com/two.jpg" },
];
let retained: MyReview;
let removed = false;

function makeReview(status: MyReview["status"] = "published"): MyReview {
  return {
    id: 8,
    text: originalText,
    status,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    edited_at: null,
    photos: existingPhotos,
    author: { id: 10, first_name: "Ana", last_name: "Cruz", avatar_url: null },
    is_own_review: true,
    show_in_community: false,
    vouched_specialties: [],
    reply: null,
    business: {
      id: 20,
      business_name: "Sugbo Cafe",
      display_cover_photo_url: null,
      category: { id: 1, name: "Cafe" },
      status: "active",
    },
  };
}

async function setup() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  client.setQueryData(myReviewsKey(99), { pages: [{ items: [{ id: 99 }] }] });
  const invalidate = jest.spyOn(client, "invalidateQueries");
  // No business-profile provider: the history screen must own synchronization.
  const screen = await render(
    <QueryClientProvider client={client}>
      <ReviewsSubmittedScreen />
    </QueryClientProvider>,
  );
  await waitFor(() => expect(screen.getByText(originalText)).toBeTruthy());
  return { screen, client, invalidate };
}

async function openEditor(screen: Awaited<ReturnType<typeof render>>) {
  await fireEvent.press(screen.getByLabelText("Review actions for Sugbo Cafe"));
  await waitFor(() => expect(screen.getByText("Edit my review")).toBeTruthy());
  expect(screen.getByText("Delete review")).toBeTruthy();
  await fireEvent.press(screen.getByText("Edit my review"));
  await waitFor(() => expect(screen.getByText("Edit review")).toBeTruthy());
}

async function openDeleteConfirmation(
  screen: Awaited<ReturnType<typeof render>>,
) {
  await fireEvent.press(screen.getByLabelText("Review actions for Sugbo Cafe"));
  await waitFor(() => expect(screen.getByText("Delete review")).toBeTruthy());
  expect(deleteReview).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText("Delete review"));
  await waitFor(() =>
    expect(screen.getByText("Delete this review?")).toBeTruthy(),
  );
  expect(deleteReview).not.toHaveBeenCalled();
}

describe("My Reviews editing integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    retained = makeReview();
    removed = false;
    useAuthStore.setState({
      user: { id: 10 } as User,
      isAuthenticated: true,
      isLoading: false,
    });
    (getMyReviews as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        items: removed ? [] : [retained],
        pagination: {
          page: 1,
          page_size: 10,
          total_items: removed ? 0 : 1,
          total_pages: removed ? 0 : 1,
          has_next: false,
          has_previous: false,
        },
      },
    }));
    (deleteReview as jest.Mock).mockImplementation(async (reviewId) => {
      removed = true;
      return { success: true, data: { review_id: reviewId } };
    });
    (updateReview as jest.Mock).mockImplementation(
      async (_id, text, photos, keepIds, community) => {
        retained = {
          ...retained,
          text: text ?? retained.text,
          photos: [
            ...retained.photos.filter(
              (photo) => keepIds === undefined || keepIds.includes(photo.id),
            ),
            ...photos.map((photo: { uri: string }, index: number) => ({
              id: 100 + index,
              photo_url: photo.uri,
            })),
          ],
          show_in_community: community ?? retained.show_in_community,
        };
        return { success: true, data: retained };
      },
    );
    (pickBusinessPhotos as jest.Mock).mockResolvedValue([
      { uri: "file:///new.jpg" },
    ]);
    (getBusinessReviewPreview as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        reviews: [],
        total_count: 1,
        user_review: {
          ...retained,
          sentiment_label: "positive",
          sentiment_score: 0.8,
        },
      },
    }));
    (getExploreBusinessDetail as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        id: 20,
        review_insights: {
          state: "insufficient_reviews",
          sentiment_computed_at: new Date(Date.now() + 1000).toISOString(),
          updated_at: new Date(Date.now() + 1000).toISOString(),
          generated_at: null,
        },
      },
    }));
  });

  it("prepopulates the existing composer and closes an unsaved draft without changing history", async () => {
    const { screen, client } = await setup();
    await openEditor(screen);
    expect(screen.getByDisplayValue(originalText)).toBeTruthy();
    expect(
      screen.getByLabelText(`Remove ${existingPhotos[0].photo_url}`),
    ).toBeTruthy();
    expect(screen.getByRole("switch").props.value).toBe(false);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    await fireEvent.press(screen.getByLabelText("Close"));
    expect(updateReview).not.toHaveBeenCalled();
    expect(screen.getByText(originalText)).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it("updates visible history and scoped business caches, and runs real derived synchronization", async () => {
    const { screen, client, invalidate } = await setup();
    await openEditor(screen);
    expect(getBusinessReviewPreview).not.toHaveBeenCalled();
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.queryByText("Edit review")).toBeNull());
    expect(screen.getByText(changedText)).toBeTruthy();
    expect(updateReview).toHaveBeenCalledWith(
      8,
      changedText,
      [],
      undefined,
      undefined,
    );
    for (const queryKey of [
      myReviewsKey(10),
      businessReviewsKey(20),
      businessReviewPreviewKey(20),
      exploreBusinessDetailKey(20),
      COMMUNITY_REVIEWS_QUERY_KEY,
    ]) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey });
    }
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: myReviewsKey(99) });
    await waitFor(() =>
      expect(getBusinessReviewPreview).toHaveBeenCalledWith(20),
    );
    expect(getExploreBusinessDetail).toHaveBeenCalledWith(20);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: DISCOVERY_FEED_QUERY_KEY,
      }),
    );
    expect(Toast.show).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success" }),
    );
    await screen.unmount();
    client.clear();
  });

  it.each(["subset", "remove-all", "add", "replace"])(
    "reuses composer photo handling: %s",
    async (mode) => {
      const { screen, client } = await setup();
      await openEditor(screen);
      if (mode !== "add")
        await fireEvent.press(
          screen.getByLabelText(`Remove ${existingPhotos[0].photo_url}`),
        );
      if (mode === "remove-all" || mode === "replace")
        await fireEvent.press(
          screen.getByLabelText(`Remove ${existingPhotos[1].photo_url}`),
        );
      if (mode === "add" || mode === "replace")
        await fireEvent.press(screen.getByLabelText("Add review photo"));
      await fireEvent.press(screen.getByText("Save changes"));
      await waitFor(() => expect(updateReview).toHaveBeenCalled());
      const expectedIds =
        mode === "subset" ? [34] : mode === "add" ? [12, 34] : [];
      const expectedUploads =
        mode === "add" || mode === "replace"
          ? [{ uri: "file:///new.jpg" }]
          : [];
      expect(updateReview).toHaveBeenCalledWith(
        8,
        undefined,
        expectedUploads,
        expectedIds,
        undefined,
      );
      await waitFor(() => expect(screen.queryByText("Edit review")).toBeNull());
      expect(retained.photos).toHaveLength(
        expectedIds.length + expectedUploads.length,
      );
      expect(getBusinessReviewPreview).not.toHaveBeenCalled();
      await screen.unmount();
      client.clear();
    },
  );

  it("hides editing for under-review submissions", async () => {
    retained = makeReview("under_review");
    const { screen, client } = await setup();
    await fireEvent.press(
      screen.getByLabelText("Review actions for Sugbo Cafe"),
    );
    await waitFor(() => expect(screen.getByText("Delete review")).toBeTruthy());
    expect(screen.queryByText("Edit my review")).toBeNull();
    expect(screen.getAllByText("Under review").length).toBeGreaterThan(0);
    await screen.unmount();
    client.clear();
  });

  it("requires confirmation and cancels without calling DELETE", async () => {
    const { screen, client } = await setup();
    await openDeleteConfirmation(screen);
    await fireEvent.press(screen.getByText("Cancel"));
    await waitFor(() =>
      expect(screen.queryByText("Delete this review?")).toBeNull(),
    );
    expect(deleteReview).not.toHaveBeenCalled();
    expect(screen.getByText(originalText)).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it.each(["published", "under_review", "rejected", "flagged"] as const)(
    "deletes a %s review and synchronizes affected caches",
    async (status) => {
      retained = makeReview(status);
      const { screen, client, invalidate } = await setup();
      await openDeleteConfirmation(screen);
      await fireEvent.press(screen.getByText("Delete review"));
      await waitFor(() =>
        expect(screen.queryByText("Delete this review?")).toBeNull(),
      );
      expect(deleteReview).toHaveBeenCalledTimes(1);
      expect(deleteReview).toHaveBeenCalledWith(8);
      expect(screen.queryByText(originalText)).toBeNull();
      expect(screen.getByTestId("my-reviews-empty")).toBeTruthy();
      for (const queryKey of [
        myReviewsKey(10),
        businessReviewsKey(20),
        businessReviewPreviewKey(20),
        exploreBusinessDetailKey(20),
        COMMUNITY_REVIEWS_QUERY_KEY,
        DISCOVERY_FEED_QUERY_KEY,
      ]) {
        expect(invalidate).toHaveBeenCalledWith({ queryKey });
      }
      expect(invalidate).not.toHaveBeenCalledWith({
        queryKey: myReviewsKey(99),
      });
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success", text1: "Review deleted" }),
      );
      await waitFor(() =>
        expect(getExploreBusinessDetail).toHaveBeenCalledWith(20),
      );
      await screen.unmount();
      client.clear();
    },
  );

  it("deletes even when the associated business is unavailable", async () => {
    retained.business.status = "suspended";
    const { screen, client } = await setup();
    expect(
      screen.getByLabelText("Open Sugbo Cafe business profile").props
        .accessibilityState.disabled,
    ).toBe(true);
    await openDeleteConfirmation(screen);
    await fireEvent.press(screen.getByText("Delete review"));
    await waitFor(() =>
      expect(screen.getByTestId("my-reviews-empty")).toBeTruthy(),
    );
    expect(deleteReview).toHaveBeenCalledWith(8);
    await screen.unmount();
    client.clear();
  });

  it.each(["NETWORK_ERROR", "NOT_FOUND"])(
    "preserves the review and permits retry after %s",
    async (code) => {
      (deleteReview as jest.Mock).mockResolvedValueOnce({
        success: false,
        code,
        message: "Review could not be deleted.",
      });
      const { screen, client, invalidate } = await setup();
      await openDeleteConfirmation(screen);
      await fireEvent.press(screen.getByText("Delete review"));
      await waitFor(() =>
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error" }),
        ),
      );
      expect(screen.getByText(originalText)).toBeTruthy();
      expect(screen.getByText("Delete this review?")).toBeTruthy();
      expect(invalidate).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByText("Delete review"));
      await waitFor(() =>
        expect(screen.getByTestId("my-reviews-empty")).toBeTruthy(),
      );
      expect(deleteReview).toHaveBeenCalledTimes(2);
      await screen.unmount();
      client.clear();
    },
  );

  it("keeps selection stable while another record remains in history", async () => {
    retained = { ...retained, id: 17 };
    const second = {
      ...makeReview(),
      id: 9,
      text: "Another review remains available.",
      business: {
        ...retained.business,
        id: 21,
        business_name: "Island Bakery",
      },
    };
    (getMyReviews as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        items: removed ? [second] : [retained, second],
        summary: {
          total: removed ? 1 : 2,
          published: removed ? 1 : 2,
          under_review: 0,
          not_published: 0,
        },
        pagination: {
          page: 1,
          page_size: 10,
          total_items: removed ? 1 : 2,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      },
    }));
    const { screen, client } = await setup();
    await openDeleteConfirmation(screen);
    // Background list changes must not redirect the selected deletion.
    await act(async () => {
      await client.invalidateQueries({ queryKey: myReviewsKey(10) });
    });
    await fireEvent.press(screen.getByText("Delete review"));
    await waitFor(() =>
      expect(screen.queryByText("Delete this review?")).toBeNull(),
    );
    expect(deleteReview).toHaveBeenCalledWith(17);
    expect(screen.getByText(second.text)).toBeTruthy();
    expect(screen.getByText("1 total")).toBeTruthy();
    expect(screen.queryByText(originalText)).toBeNull();
    await screen.unmount();
    client.clear();
  });

  it("retains an accepted edit when the following history refresh fails", async () => {
    const { screen, client } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    (getMyReviews as jest.Mock).mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.queryByText("Edit review")).toBeNull());
    expect(screen.getByText(changedText)).toBeTruthy();
    expect(screen.queryByText(originalText)).toBeNull();
    expect(screen.getByText("Couldn't refresh your reviews")).toBeTruthy();
    await fireEvent.press(screen.getByText("Tap to retry"));
    await waitFor(() =>
      expect(screen.queryByText("Couldn't refresh your reviews")).toBeNull(),
    );
    await screen.unmount();
    client.clear();
  });

  it("preserves an unsaved draft while history refetches", async () => {
    const { screen, client } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    retained = {
      ...retained,
      text: "A separately refreshed version of this review.",
    };
    await act(async () => {
      await screen
        .getByTestId("my-reviews-list")
        .props.refreshControl.props.onRefresh();
    });
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    await waitFor(() => expect(screen.getByText(retained.text)).toBeTruthy());
    expect(updateReview).not.toHaveBeenCalled();
    await screen.unmount();
    client.clear();
  });

  it("applies composer validation before sending an update", async () => {
    const { screen, client } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      "Too short",
    );
    await fireEvent.press(screen.getByText("Save changes"));
    expect(updateReview).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("Too short")).toBeTruthy();
    expect(screen.getByText(/Review must be at least/)).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it("removes the editor and its draft on sign-out", async () => {
    const { screen, client } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    await act(async () => {
      useAuthStore.getState().clearUser();
    });
    expect(screen.queryByText("Edit review")).toBeNull();
    expect(screen.queryByDisplayValue(changedText)).toBeNull();
    expect(updateReview).not.toHaveBeenCalled();
    await screen.unmount();
    client.clear();
  });

  it("keeps the first business synchronizing while another review is opened", async () => {
    const second = {
      ...makeReview(),
      id: 9,
      text: "A pleasant visit to a different local bakery.",
      business: {
        ...makeReview().business,
        id: 21,
        business_name: "Island Bakery",
      },
    };
    (getMyReviews as jest.Mock).mockImplementation(async () => ({
      success: true,
      data: {
        items: [retained, second],
        pagination: {
          page: 1,
          page_size: 10,
          total_items: 2,
          total_pages: 1,
          has_next: false,
          has_previous: false,
        },
      },
    }));
    (getBusinessReviewPreview as jest.Mock).mockResolvedValue({
      success: true,
      data: { reviews: [], user_review: null, total_count: 1 },
    });
    const { screen, client } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(screen.queryByText("Edit review")).toBeNull());
    await waitFor(() =>
      expect(getBusinessReviewPreview).toHaveBeenCalledWith(20),
    );
    await fireEvent.press(
      screen.getByLabelText("Review actions for Island Bakery"),
    );
    await waitFor(() =>
      expect(screen.getByText("Edit my review")).toBeTruthy(),
    );
    await fireEvent.press(screen.getByText("Edit my review"));
    await waitFor(() =>
      expect(screen.getByDisplayValue(second.text)).toBeTruthy(),
    );
    expect(
      client
        .getQueryCache()
        .find({ queryKey: businessReviewPreviewKey(20) })
        ?.isActive(),
    ).toBe(true);
    expect(
      screen.getByLabelText("You're reviewing Island Bakery"),
    ).toBeTruthy();
    await screen.unmount();
    client.clear();
  });

  it.each(["rejected", "flagged"] as const)(
    "edits %s without implying publication or polling public sentiment",
    async (status) => {
      retained = makeReview(status);
      const { screen, client } = await setup();
      await openEditor(screen);
      await fireEvent.changeText(
        screen.getByDisplayValue(originalText),
        changedText,
      );
      await fireEvent.press(screen.getByText("Save changes"));
      await waitFor(() => expect(screen.queryByText("Edit review")).toBeNull());
      expect(screen.getByText(changedText)).toBeTruthy();
      expect(screen.getAllByText("Not published").length).toBeGreaterThan(0);
      expect(retained.status).toBe(status);
      expect(getBusinessReviewPreview).not.toHaveBeenCalled();
      await screen.unmount();
      client.clear();
    },
  );

  it.each([
    "REVIEW_EDIT_CONTENT_FLAGGED",
    "REVIEW_EDIT_MODERATION_UNAVAILABLE",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
  ])("retains the draft and original history after %s", async (code) => {
    (updateReview as jest.Mock).mockResolvedValueOnce({
      success: false,
      code,
      message: "Changes could not be saved.",
    });
    const { screen, client, invalidate } = await setup();
    await openEditor(screen);
    await fireEvent.changeText(
      screen.getByDisplayValue(originalText),
      changedText,
    );
    await fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(updateReview).toHaveBeenCalled());
    expect(screen.getByDisplayValue(changedText)).toBeTruthy();
    expect(screen.getByText(originalText)).toBeTruthy();
    if (code.startsWith("REVIEW_EDIT"))
      expect(screen.getByTestId("review-edit-error-banner")).toBeTruthy();
    else
      await waitFor(() =>
        expect(Toast.show).toHaveBeenCalledWith(
          expect.objectContaining({ type: "error" }),
        ),
      );
    expect(invalidate).not.toHaveBeenCalled();
    await screen.unmount();
    client.clear();
  });
});
