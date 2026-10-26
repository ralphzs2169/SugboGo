import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { FlatList } from "react-native";

import useExploreFilterOptions from "@/features/explore/hooks/useExploreFilterOptions";
import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

import { useCommunityReviews } from "../../hooks/useCommunityReviews";
import CommunityScreen from "../CommunityScreen";
import type { CommunityReview } from "../../types/communityReview.types";

const mockFetchNextPage = jest.fn(async () => undefined);
const mockRefetch = jest.fn(async () => undefined);
const mockTaxonomyRefetch = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock("lottie-react-native", () => () => null);
jest.mock("@/shared/hooks/useTabBarSpacing", () => ({
  useTabBarSpacing: () => 80,
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock(
  "@/features/notifications/components/NotificationBellButton",
  () => () => null,
);
jest.mock("@/features/explore/hooks/useExploreFilterOptions");
jest.mock("../../hooks/useCommunityReviews");
jest.mock("../../components/CommunityFilterBottomSheet", () => ({
  __esModule: true,
  default: ({ onApply }: { onApply: (filters: unknown) => void }) => {
    const { Pressable, Text } = jest.requireActual("react-native");
    return (
      <>
        <Pressable
          testID="mock-apply-filters"
          onPress={() =>
            onApply({
              ordering: "most_helpful",
              clusterId: 3,
              categoryIds: [5],
              specialtyTagId: 8,
              hasPhotos: true,
            })
          }
        >
          <Text>Apply</Text>
        </Pressable>
        <Pressable
          testID="mock-apply-equivalent-filters"
          onPress={() =>
            onApply({
              ordering: "most_helpful",
              clusterId: 3,
              categoryIds: [5, 5],
              specialtyTagId: 8,
              hasPhotos: true,
            })
          }
        >
          <Text>Apply equivalent filters</Text>
        </Pressable>
      </>
    );
  },
}));
jest.mock("../../components/CommunityReviewCard", () => ({
  __esModule: true,
  default: ({ review }: { review: CommunityReview }) => {
    const { Text } = jest.requireActual("react-native");

    return <Text testID={`rendered-review-${review.id}`}>{review.text}</Text>;
  },
}));

const review = {
  id: 7,
  text: "A thoughtful Community review.",
} as CommunityReview;

function communityState(overrides: Record<string, unknown> = {}) {
  return {
    reviews: [review],
    hasData: true,
    isSuccess: true,
    isPaused: false,
    pages: [],
    totalCount: 1,
    hasNextPage: false,
    fetchNextPage: mockFetchNextPage,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isPlaceholderData: false,
    isLoading: false,
    isInitialLoading: false,
    isFetching: false,
    isRefetching: false,
    error: null,
    refetch: mockRefetch,
    ...overrides,
  };
}

function taxonomyState(overrides: Record<string, unknown> = {}) {
  return {
    options: {
      clusters: [{ id: 3, name: "Food", icon: "utensils" }],
      categories: [],
      specialty_tags: [],
    },
    isLoading: false,
    error: null,
    refetch: mockTaxonomyRefetch,
    ...overrides,
  };
}

describe("CommunityScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useCommunityReviews as jest.Mock).mockReturnValue(communityState());
    (useExploreFilterOptions as jest.Mock).mockReturnValue(taxonomyState());
  });

  it("shows the initial loading skeleton", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({
        reviews: [],
        totalCount: 0,
        isLoading: true,
        isInitialLoading: true,
        isFetching: true,
        hasData: false,
        isSuccess: false,
      }),
    );

    const screen = await render(<CommunityScreen />);

    expect(screen.getByLabelText("Loading Community reviews")).toBeTruthy();
    expect(screen.queryByTestId("community-empty")).toBeNull();
  });

  it("shows the compact Community heading and filter control", async () => {
    const screen = await render(<CommunityScreen />);
    expect(screen.getByText("Community")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Filters" })).toBeTruthy();
  });

  it("shows a persistent error and retries only the Community query", async () => {
    const error = {
      success: false,
      message: "Offline",
      code: "NETWORK_ERROR",
    };
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ reviews: [], totalCount: 0, error }),
    );

    const screen = await render(<CommunityScreen />);
    await fireEvent.press(screen.getByText("Retry"));

    expect(screen.getByTestId("community-error")).toBeTruthy();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ error, toastId: "community-reviews" }),
    );
  });

  it("applies the sheet selection as one query change", async () => {
    const screen = await render(<CommunityScreen />);
    await fireEvent.press(screen.getByRole("button", { name: "Filters" }));
    await fireEvent.press(screen.getByTestId("mock-apply-filters"));

    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith({
        ordering: "most_helpful",
        clusterId: 3,
        categoryIds: [5],
        specialtyTagId: 8,
        hasPhotos: true,
      });
      expect(
        screen.getByRole("button", { name: "Filters, 3 active" }),
      ).toBeTruthy();
    });
  });

  it("preserves reviews when background refresh fails", async () => {
    const screen = await render(<CommunityScreen />);
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ error: new Error("Offline") }),
    );
    await screen.rerender(<CommunityScreen />);
    expect(screen.getByTestId("rendered-review-7")).toBeTruthy();
    expect(screen.queryByTestId("community-error")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Retry refreshing Community reviews",
      }),
    ).toBeTruthy();
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ error: null, toastId: "community-reviews" }),
    );

    await fireEvent.press(
      screen.getByRole("button", {
        name: "Retry refreshing Community reviews",
      }),
    );
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    (useCommunityReviews as jest.Mock).mockReturnValue(communityState());
    await screen.rerender(<CommunityScreen />);
    expect(
      screen.queryByRole("button", {
        name: "Retry refreshing Community reviews",
      }),
    ).toBeNull();
  });

  it("shows recovery instead of empty content for a paused first request", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({
        reviews: [],
        hasData: false,
        isSuccess: false,
        isPaused: true,
      }),
    );
    const screen = await render(<CommunityScreen />);

    expect(screen.getByTestId("community-offline")).toBeTruthy();
    expect(screen.queryByTestId("community-empty")).toBeNull();
    expect(screen.queryByTestId("community-feed-skeleton")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(mockRefetch).toHaveBeenCalledTimes(1);

    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ reviews: [], totalCount: 0 }),
    );
    await screen.rerender(<CommunityScreen />);
    expect(screen.getByTestId("community-empty")).toBeTruthy();
    expect(screen.queryByTestId("community-offline")).toBeNull();
  });

  it("keeps cached reviews visible while requests are paused", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ isPaused: true }),
    );
    const screen = await render(<CommunityScreen />);

    expect(screen.getByTestId("rendered-review-7")).toBeTruthy();
    expect(screen.queryByTestId("community-offline")).toBeNull();
    expect(screen.queryByTestId("community-feed-skeleton")).toBeNull();
  });

  it("does not show empty content before a successful response exists", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ reviews: [], hasData: false, isSuccess: false }),
    );
    const screen = await render(<CommunityScreen />);

    expect(screen.queryByTestId("community-empty")).toBeNull();
    expect(screen.getByTestId("community-feed-skeleton")).toBeTruthy();
  });

  it("preserves applied filter identity and scroll for equivalent selections", async () => {
    const scrollToOffset = jest.spyOn(FlatList.prototype, "scrollToOffset");
    const screen = await render(<CommunityScreen />);
    await fireEvent.press(screen.getByTestId("mock-apply-filters"));
    const appliedFilters = (useCommunityReviews as jest.Mock).mock.calls.at(
      -1,
    )[0];
    scrollToOffset.mockClear();

    await fireEvent.press(screen.getByTestId("mock-apply-equivalent-filters"));

    expect((useCommunityReviews as jest.Mock).mock.calls.at(-1)[0]).toBe(
      appliedFilters,
    );
    expect(scrollToOffset).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "With photos" }));
    expect(scrollToOffset).toHaveBeenCalledTimes(1);
    scrollToOffset.mockRestore();
  });

  it("preserves reviews and retries a failed continuation", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({
        error: new Error("Page failed"),
        isFetchNextPageError: true,
        hasNextPage: true,
      }),
    );
    const screen = await render(<CommunityScreen />);
    expect(screen.getByTestId("rendered-review-7")).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Retry loading reviews" }),
    );
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", {
        name: "Retry refreshing Community reviews",
      }),
    ).toBeNull();
  });
});
