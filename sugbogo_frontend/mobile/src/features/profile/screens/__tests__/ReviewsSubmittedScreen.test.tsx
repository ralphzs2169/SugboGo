import { act, fireEvent, render, within } from "@testing-library/react-native";
import { router } from "expo-router";

import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";
import { useMyReviews } from "../../hooks/useMyReviews";
import type { MyReview } from "../../types/myReview.types";
import ReviewsSubmittedScreen from "../ReviewsSubmittedScreen";

jest.mock("../../hooks/useMyReviews");
jest.mock(
  "@/shared/components/bottom-sheets/ActionBottomSheet",
  () => () => null,
);
jest.mock(
  "@/features/explore/components/business-profile/ReviewComposerSheet",
  () => () => null,
);
jest.mock("@/features/explore/hooks/ReviewDerivedDataSyncProvider", () => ({
  ReviewDerivedDataSyncProvider: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useIsFocused: () => true,
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, left: 0, right: 0, bottom: 24 }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("lottie-react-native", () => () => null);
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => {
    const { Text } = jest.requireActual("react-native");
    return visible ? <Text>Photo viewer open</Text> : null;
  },
}));

const refetch = jest.fn(async () => undefined);
const fetchNextPage = jest.fn(async () => undefined);

function review(id = 1, status: MyReview["status"] = "published"): MyReview {
  return {
    id,
    status,
    text: `Review content ${id}`,
    created_at: "2026-10-01T12:00:00Z",
    updated_at: "2026-10-01T12:00:00Z",
    edited_at: null,
    photos: [{ id: 5, photo_url: "https://example.com/photo.jpg" }],
    author: { id: 10, first_name: "Ana", last_name: "Cruz", avatar_url: null },
    is_own_review: true,
    show_in_community: false,
    vouched_specialties: [],
    reply: {
      id: 3,
      text: "Thank you for visiting",
      created_at: "2026-10-02T12:00:00Z",
      updated_at: "2026-10-02T12:00:00Z",
      photos: [],
    },
    business: {
      id,
      business_name: `Business ${id}`,
      display_cover_photo_url: null,
      category: { id: 1, name: "Cafe" },
      status: "active",
    },
  };
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    reviews: [review()],
    totalCount: 12,
    summary: { total: 12, published: 12, under_review: 0, not_published: 0 },
    userId: 10,
    isEnabled: true,
    isAuthLoading: false,
    isPending: false,
    isFetching: false,
    isRefetching: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    hasNextPage: false,
    error: null,
    refetch,
    fetchNextPage,
    ...overrides,
  };
}

describe("ReviewsSubmittedScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useMyReviews as jest.Mock).mockReturnValue(state());
  });

  it("renders cross-business history, authoritative totals, and no prototype actions", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ reviews: [review(1), review(2)] }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.getByText("Business 1")).toBeTruthy();
    expect(screen.getByText("Business 2")).toBeTruthy();
    expect(screen.getByText("Review content 1")).toBeTruthy();
    expect(screen.getByText("12 total")).toBeTruthy();
    expect(screen.queryByText("Edit")).toBeNull();
    expect(screen.queryByText("Delete")).toBeNull();
    expect(screen.queryByPlaceholderText(/Search/)).toBeNull();
  });

  it.each([
    ["published", "Published"],
    ["under_review", "Under review"],
    ["rejected", "Not published"],
    ["flagged", "Not published"],
  ] as const)(
    "presents %s without fabricating moderation reasons",
    async (status, label) => {
      (useMyReviews as jest.Mock).mockReturnValue(
        state({ reviews: [review(1, status)] }),
      );
      const screen = await render(<ReviewsSubmittedScreen />);
      expect(
        within(screen.getByTestId("my-review-1")).getByText(label),
      ).toBeTruthy();
      expect(screen.getByText("Review content 1")).toBeTruthy();
    },
  );

  it("shows routine checking distinctly from team moderation", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({
        reviews: [
          {
            ...review(1, "under_review"),
            moderation_progress: { state: "pending" },
          },
        ],
      }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    const item = within(screen.getByTestId("my-review-1"));
    expect(item.getByText("Checking")).toBeTruthy();
    expect(item.queryByText("Under review")).toBeNull();
  });

  it("opens shared review photos and expands the merchant response", async () => {
    const screen = await render(<ReviewsSubmittedScreen />);
    await fireEvent.press(screen.getByLabelText("View review photo 1"));
    expect(screen.getByText("Photo viewer open")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Expand owner response"));
    expect(screen.getByText("Thank you for visiting")).toBeTruthy();
  });

  it("supports reviews without photos or replies", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ reviews: [{ ...review(), photos: [], reply: null }] }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.queryByLabelText("View review photo 1")).toBeNull();
    expect(screen.queryByLabelText("Expand owner response")).toBeNull();
  });

  it.each(["active", "suspended", "unknown"])(
    "restricts business navigation for %s",
    async (status) => {
      const item = review();
      item.business.status = status;
      (useMyReviews as jest.Mock).mockReturnValue(state({ reviews: [item] }));
      const screen = await render(<ReviewsSubmittedScreen />);
      await fireEvent.press(
        screen.getByLabelText("Open Business 1 business profile"),
      );
      if (status === "active") {
        expect(router.push).toHaveBeenCalledWith({
          pathname: "/(explorer)/business/[businessId]",
          params: { businessId: "1" },
        });
      } else {
        expect(router.push).not.toHaveBeenCalled();
        expect(
          screen.getByLabelText("Open Business 1 business profile").props
            .accessibilityState.disabled,
        ).toBe(true);
      }
    },
  );

  it("shows card skeletons while initially loading", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ reviews: [], isPending: true }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.getByTestId("my-reviews-skeleton")).toBeTruthy();
    expect(screen.queryByTestId("my-reviews-empty")).toBeNull();
  });

  it("uses the actual login route when the session is unavailable", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ reviews: [], isEnabled: false }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    await fireEvent.press(screen.getByText("Sign in"));
    expect(router.push).toHaveBeenCalledWith("/(auth)/login");
  });

  it("offers exploration only for a successful empty history", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ reviews: [], totalCount: 0 }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    await fireEvent.press(screen.getByText("Explore businesses"));
    expect(router.push).toHaveBeenCalledWith("/(explorer)/(tabs)/explore");
  });

  it("exposes errors to the notification hook and retries the failed query", async () => {
    const error = new Error("Offline");
    (useMyReviews as jest.Mock).mockReturnValue(state({ reviews: [], error }));
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ error }),
    );
    expect(screen.queryByTestId("my-reviews-empty")).toBeNull();
    await fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("refreshes in place without replacing loaded reviews", async () => {
    const screen = await render(<ReviewsSubmittedScreen />);
    await act(async () => {
      screen
        .getByTestId("my-reviews-list")
        .props.refreshControl.props.onRefresh();
    });
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Review content 1")).toBeTruthy();
  });

  it("guards repeated pagination callbacks until another scroll", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(state({ hasNextPage: true }));
    const screen = await render(<ReviewsSubmittedScreen />);
    const list = screen.getByTestId("my-reviews-list");
    await fireEvent(list, "endReached");
    expect(fetchNextPage).not.toHaveBeenCalled();
    await fireEvent(list, "scrollBeginDrag");
    await act(async () => {
      await fireEvent(list, "endReached");
      await fireEvent(list, "endReached");
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("preserves loaded reviews and explicitly retries pagination errors", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({
        error: new Error("Offline"),
        isFetchNextPageError: true,
        hasNextPage: true,
      }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.getByText("Review content 1")).toBeTruthy();
    await fireEvent.press(screen.getByText("Tap to retry"));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it("retries a failed background refresh while retaining existing content", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({ error: new Error("Offline") }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.getByText("Review content 1")).toBeTruthy();
    await fireEvent.press(screen.getByText("Tap to retry"));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("keeps pagination loading distinct from pull-to-refresh", async () => {
    (useMyReviews as jest.Mock).mockReturnValue(
      state({
        hasNextPage: true,
        isFetching: true,
        isFetchingNextPage: true,
        isRefetching: true,
      }),
    );
    const screen = await render(<ReviewsSubmittedScreen />);
    expect(screen.getByTestId("my-reviews-page-loader")).toBeTruthy();
    const list = screen.getByTestId("my-reviews-list");
    expect(list.props.refreshControl.props.refreshing).toBe(false);
    await fireEvent(list, "scrollBeginDrag");
    await fireEvent(list, "endReached");
    expect(fetchNextPage).not.toHaveBeenCalled();
    expect(screen.queryByTestId("my-reviews-skeleton")).toBeNull();
  });

  it("expands long review text using the existing content control", async () => {
    const screen = await render(<ReviewsSubmittedScreen />);
    await fireEvent(screen.getByText("Review content 1"), "textLayout", {
      nativeEvent: {
        lines: Array.from({ length: 8 }, () => ({ text: "Line" })),
      },
    });
    await fireEvent.press(screen.getByLabelText("Read full review"));
    expect(screen.getByLabelText("Show less of review")).toBeTruthy();
  });
});
