import { act, fireEvent, render } from "@testing-library/react-native";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import {
  useBusinessReviewPreview,
  useBusinessReviews,
} from "../../hooks/useBusinessReviews";
import useExploreBusinessProfile from "../../hooks/useExploreBusinessProfile";
import type { BusinessReview } from "../../types/review.types";
import ExploreBusinessReviewsScreen from "../ReviewsCollectionScreen";

const mockSetOptions = jest.fn();

jest.setTimeout(15_000);

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ setOptions: mockSetOptions }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("../../hooks/useBusinessReviews");
jest.mock("../../hooks/useExploreBusinessProfile");
jest.mock("@/shared/hooks/useQueryErrorNotification", () => jest.fn());
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("lottie-react-native", () => ({
  __esModule: true,
  default: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return <Text>Loading animation</Text>;
  },
}));
jest.mock("../../components/business-profile/ReviewComposerSheet", () => ({
  __esModule: true,
  default: ({ review }: { review: BusinessReview | null }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return review ? <Text>Editing review {review.id}</Text> : null;
  },
}));
jest.mock(
  "../../components/business-profile/state/BusinessReviewsSkeleton",
  () => ({
    __esModule: true,
    default: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Text } = require("react-native");

      return <Text>Reviews loading</Text>;
    },
  }),
);
jest.mock("../../components/business-profile/BusinessProfileFooter", () => ({
  __esModule: true,
  default: () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return <Text>Manage My Business</Text>;
  },
}));
jest.mock(
  "../../components/business-profile/reviews/review-collection/ReviewFiltersSection",
  () => ({
    __esModule: true,
    default: ({
      filters,
      onChange,
      onClear,
    }: {
      filters: { sentiment: string | null };
      onChange: (value: unknown) => void;
      onClear: () => void;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pressable, Text, View } = require("react-native");

      return (
        <View>
          <Text>Review Vibe</Text>
          <Pressable
            onPress={() => onChange({ ...filters, sentiment: "negative" })}
          >
            <Text>Negative filter</Text>
          </Pressable>
          <Pressable onPress={onClear}>
            <Text>Clear filters</Text>
          </Pressable>
        </View>
      );
    },
  }),
);
jest.mock(
  "../../components/business-profile/reviews/BusinessReviewCard",
  () => ({
    __esModule: true,
    default: ({
      review,
      isLast,
    }: {
      review: BusinessReview;
      isLast: boolean;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Text, View } = require("react-native");

      return (
        <View testID="review-card">
          <Text>Review {review.id}</Text>
          {isLast && <Text>Last review {review.id}</Text>}
        </View>
      );
    },
  }),
);

const reviews = [1, 2, 3].map((id) => ({ id }) as BusinessReview);

function reviewQuery(overrides: Record<string, unknown> = {}) {
  return {
    reviews,
    totalCount: 3,
    hasNextPage: false,
    fetchNextPage: jest.fn().mockResolvedValue(undefined),
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    isPlaceholderData: false,
    isInitialLoading: false,
    isFetching: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function preview(overrides: Record<string, unknown> = {}) {
  return {
    reviews: reviews.slice(0, 3),
    totalCount: 3,
    userReview: null,
    hasOwnReview: false,
    isLoading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe("ExploreBusinessReviewsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(preview());
    (useBusinessReviews as jest.Mock).mockReturnValue(reviewQuery());
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: null,
      isLoading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("uses the skeleton for the initial load", async () => {
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ isInitialLoading: true, reviews: [] }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getByText("Reviews loading")).toBeTruthy();
  });

  it("keeps the initial retry and Go Back error state", async () => {
    const refetch = jest.fn();
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ error: new Error("unavailable"), reviews: [], refetch }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    await press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
    expect(screen.getByText("Go Back")).toBeTruthy();
  });

  it("renders flattened reviews in hook order and marks the final loaded item", async () => {
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getAllByTestId("review-card")).toHaveLength(3);
    expect(
      screen
        .getAllByText(/^Review \d$/)
        .map((item) => item.props.children.join("")),
    ).toEqual(["Review 1", "Review 2", "Review 3"]);
    expect(screen.getByText("Last review 3")).toBeTruthy();
    expect(screen.queryByText("Last review 2")).toBeNull();
  });

  it("guards duplicate end-reached events", async () => {
    const fetchNextPage = jest.fn().mockResolvedValue(undefined);
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ hasNextPage: true, fetchNextPage }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    const list = screen.getByTestId("reviews-list");

    list.props.onEndReached();
    list.props.onEndReached();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("does not load beyond the final page", async () => {
    const fetchNextPage = jest.fn();
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ hasNextPage: false, fetchNextPage }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    screen.getByTestId("reviews-list").props.onEndReached();
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("keeps loaded reviews available after a later page fails", async () => {
    const fetchNextPage = jest.fn().mockResolvedValue(undefined);
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({
        error: new Error("later page unavailable"),
        isFetchNextPageError: true,
        hasNextPage: true,
        fetchNextPage,
      }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getAllByTestId("review-card")).toHaveLength(3);
    await press(screen.getByText("Retry loading reviews"));
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("shows next-page loading", async () => {
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ isFetchingNextPage: true, hasNextPage: true }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    expect(screen.getByTestId("reviews-page-loader")).toBeTruthy();
  });

  it("shows the completed message after enough reviews load", async () => {
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({
        reviews: [1, 2, 3, 4, 5].map((id) => ({ id }) as BusinessReview),
        totalCount: 5,
      }),
    );
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(
      preview({ totalCount: 5 }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    expect(screen.getByText(/end/i)).toBeTruthy();
    expect(screen.queryByTestId("reviews-page-loader")).toBeNull();
  });

  it("refreshes active reviews, ownership, and insights without resetting filters", async () => {
    const refetchReviews = jest.fn().mockResolvedValue(undefined);
    const refetchPreview = jest.fn().mockResolvedValue(undefined);
    const refetchInsights = jest.fn().mockResolvedValue(undefined);
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ refetch: refetchReviews }),
    );
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(
      preview({ refetch: refetchPreview }),
    );
    (useExploreBusinessProfile as jest.Mock).mockReturnValue({
      business: null,
      isLoading: false,
      error: null,
      refetch: refetchInsights,
    });
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    await press(screen.getByText("Negative filter"));
    await act(async () => {
      await screen
        .getByTestId("reviews-list")
        .props.refreshControl.props.onRefresh();
    });

    expect(refetchReviews).toHaveBeenCalled();
    expect(refetchPreview).toHaveBeenCalled();
    expect(refetchInsights).toHaveBeenCalled();
    expect(useBusinessReviews).toHaveBeenLastCalledWith(
      20,
      expect.objectContaining({ sentiment: "negative" }),
    );
  });

  it("keeps previous reviews visible during a filter update", async () => {
    (useBusinessReviews as jest.Mock).mockImplementation(
      (_businessId, filters) =>
        filters?.sentiment
          ? reviewQuery({ isFetching: true, isPlaceholderData: true })
          : reviewQuery(),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    await press(screen.getByText("Negative filter"));
    expect(screen.getAllByTestId("review-card")).toHaveLength(3);
    expect(screen.queryByText("Reviews loading")).toBeNull();
    expect(screen.getByText("Loading animation")).toBeTruthy();
  });

  it("distinguishes filtered empty results from a truly empty business", async () => {
    (useBusinessReviews as jest.Mock).mockImplementation(
      (_businessId, filters) =>
        filters?.sentiment
          ? reviewQuery({ reviews: [], totalCount: 0 })
          : reviewQuery(),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    await press(screen.getByText("Negative filter"));
    expect(screen.getByText("No reviews match these filters")).toBeTruthy();
    expect(screen.queryByText("No reviews yet")).toBeNull();
  });

  it("shows the mascot state for a truly empty business", async () => {
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(
      preview({ totalCount: 0 }),
    );
    (useBusinessReviews as jest.Mock).mockReturnValue(
      reviewQuery({ reviews: [], totalCount: 0 }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    expect(screen.getByText("No reviews yet")).toBeTruthy();
    expect(screen.getByText("Write a review")).toBeTruthy();
    expect(screen.getAllByLabelText("Write a review")).toHaveLength(1);
  });

  it("uses authoritative ownership when the user's review is not loaded", async () => {
    const ownReview = { id: 99, is_own_review: true } as BusinessReview;
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(
      preview({ userReview: ownReview, hasOwnReview: true, totalCount: 12 }),
    );
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.queryByText("Your review")).toBeNull();
    expect(screen.queryByLabelText("Edit your review")).toBeNull();
    expect(screen.queryByText("Write a review")).toBeNull();
  });

  it("shows the floating review action for an eligible nonempty business", async () => {
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    const writeReview = screen.getByLabelText("Write a review");
    expect(writeReview).toBeTruthy();
    await press(writeReview);
    expect(presentBottomSheet).toHaveBeenCalledTimes(1);
  });

  it("keeps the navigation count tied to the unfiltered ownership total", async () => {
    (useBusinessReviewPreview as jest.Mock).mockReturnValue(
      preview({ totalCount: 28 }),
    );
    (useBusinessReviews as jest.Mock).mockImplementation(
      (_businessId, filters) =>
        reviewQuery({ totalCount: filters?.sentiment ? 4 : 28 }),
    );

    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );
    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: "Reviews (28)" });

    await press(screen.getByText("Negative filter"));

    expect(mockSetOptions).toHaveBeenLastCalledWith({ title: "Reviews (28)" });
    expect(mockSetOptions).not.toHaveBeenCalledWith({ title: "Reviews (4)" });
  });

  it("prevents the business owner from writing", async () => {
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness />,
    );
    expect(screen.queryByText("Write a review")).toBeNull();
    expect(screen.getByText("Manage My Business")).toBeTruthy();
  });
});
