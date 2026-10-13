import { act, fireEvent, render, waitFor } from "@testing-library/react-native";

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
jest.mock("@/features/explore/hooks/useExploreFilterOptions");
jest.mock("../../hooks/useCommunityReviews");
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
      }),
    );

    const screen = await render(<CommunityScreen />);

    expect(screen.getByTestId("community-loading")).toBeTruthy();
    expect(screen.queryByTestId("community-empty")).toBeNull();
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
    fireEvent.press(screen.getByText("Retry"));

    expect(screen.getByTestId("community-error")).toBeTruthy();
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(useQueryErrorNotification).toHaveBeenCalledWith(
      expect.objectContaining({ error, toastId: "community-reviews" }),
    );
  });

  it("distinguishes a true empty feed from a filtered empty result", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ reviews: [], totalCount: 0 }),
    );

    const screen = await render(<CommunityScreen />);
    expect(screen.getByTestId("community-empty")).toBeTruthy();

    fireEvent.press(screen.getByLabelText("With Photos"));

    await waitFor(() => {
      expect(screen.getByTestId("community-filter-empty")).toBeTruthy();
    });

    fireEvent.press(screen.getByText("Clear filters"));
    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith({
        ordering: "newest",
        clusterId: null,
        hasPhotos: false,
      });
      expect(screen.getByTestId("community-empty")).toBeTruthy();
    });
  });

  it("renders each review once while preserving its first occurrence", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ reviews: [review, review] }),
    );

    const screen = await render(<CommunityScreen />);

    expect(screen.getAllByTestId("rendered-review-7")).toHaveLength(1);
    expect(screen.getByText(review.text)).toBeTruthy();
  });

  it("applies cluster, sorting, and photo filters through the query hook", async () => {
    const screen = await render(<CommunityScreen />);

    fireEvent.press(screen.getByLabelText("Show Food Community reviews"));
    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith(
        expect.objectContaining({ clusterId: 3 }),
      );
    });

    fireEvent.press(
      screen.getByLabelText("Sort Community reviews by Most Helpful"),
    );
    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith(
        expect.objectContaining({ ordering: "most_helpful" }),
      );
    });

    fireEvent.press(screen.getByLabelText("With Photos"));

    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith({
        ordering: "most_helpful",
        clusterId: 3,
        hasPhotos: true,
      });
    });
  });

  it("retains every filter when controls are pressed before a rerender", async () => {
    const screen = await render(<CommunityScreen />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Show Food Community reviews"));
      fireEvent.press(
        screen.getByLabelText("Sort Community reviews by Most Helpful"),
      );
      fireEvent.press(screen.getByLabelText("With Photos"));
    });

    await waitFor(() => {
      expect(useCommunityReviews).toHaveBeenLastCalledWith({
        ordering: "most_helpful",
        clusterId: 3,
        hasPhotos: true,
      });
    });
  });

  it("does not reset results when the selected cluster or sort is tapped", async () => {
    const screen = await render(<CommunityScreen />);
    const initialQueryCalls = (useCommunityReviews as jest.Mock).mock.calls
      .length;

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Show All Community reviews"));
      fireEvent.press(
        screen.getByLabelText("Sort Community reviews by Newest, selected"),
      );
    });

    expect((useCommunityReviews as jest.Mock).mock.calls).toHaveLength(
      initialQueryCalls,
    );
  });

  it("guards duplicate pagination calls and supports pull-to-refresh", async () => {
    let resolveNextPage: (() => void) | undefined;
    mockFetchNextPage.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          resolveNextPage = () => resolve(undefined);
        }),
    );
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({ hasNextPage: true }),
    );

    const screen = await render(<CommunityScreen />);
    const list = await screen.findByTestId("community-review-list");

    await act(async () => {
      list.props.onEndReached();
    });
    expect(mockFetchNextPage).not.toHaveBeenCalled();

    await act(async () => {
      list.props.onScrollBeginDrag();
      list.props.onEndReached();
      list.props.onEndReached();
      list.props.refreshControl.props.onRefresh();
    });

    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(list.props.onEndReachedThreshold).toBe(0.35);

    await act(async () => {
      resolveNextPage?.();
    });

    await act(async () => {
      list.props.onEndReached();
    });
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("keeps loaded reviews after a page error and retries only on request", async () => {
    (useCommunityReviews as jest.Mock).mockReturnValue(
      communityState({
        hasNextPage: true,
        isFetchNextPageError: true,
        error: { success: false, message: "Offline" },
      }),
    );

    const screen = await render(<CommunityScreen />);
    const list = await screen.findByTestId("community-review-list");

    await act(async () => {
      list.props.onScrollBeginDrag();
      list.props.onEndReached();
      list.props.onEndReached();
    });
    expect(mockFetchNextPage).not.toHaveBeenCalled();
    expect(screen.getByTestId("rendered-review-7")).toBeTruthy();
    expect(screen.queryByTestId("community-error")).toBeNull();

    fireEvent.press(screen.getByText("Retry loading reviews"));
    expect(mockFetchNextPage).toHaveBeenCalledTimes(1);
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it("shows completion feedback after the final non-empty page", async () => {
    const screen = await render(<CommunityScreen />);
    const list = await screen.findByTestId("community-review-list");

    expect(list.props.ListFooterComponent.props.description).toBe(
      "You've seen every Community review.",
    );
  });
});
