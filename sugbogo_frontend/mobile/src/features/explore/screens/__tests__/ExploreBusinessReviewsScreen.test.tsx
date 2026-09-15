import { fireEvent, render } from "@testing-library/react-native";

import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import { useBusinessReviews } from "../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../types/review.types";
import ExploreBusinessReviewsScreen from "../ExploreBusinessReviewsScreen";

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({ setOptions: jest.fn() }),
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("../../hooks/useBusinessReviews");
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));
jest.mock("../../components/business-profile/ReviewComposerSheet", () => ({
  __esModule: true,
  default: () => null,
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
  default: ({ isOwnBusiness }: { isOwnBusiness: boolean }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return isOwnBusiness ? <Text>Manage My Business</Text> : null;
  },
}));
jest.mock(
  "../../components/business-profile/review-section/BusinessReviewCard",
  () => ({
    __esModule: true,
    default: ({
      review,
      onEdit,
    }: {
      review: BusinessReview;
      onEdit: (review: BusinessReview) => void;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pressable, Text } = require("react-native");

      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit review ${review.id}`}
          onPress={() => onEdit(review)}
        >
          <Text>{review.text}</Text>
        </Pressable>
      );
    },
  }),
);

const ownReview = {
  id: 1,
  text: "My review",
  is_own_review: true,
} as BusinessReview;

const communityReview = {
  id: 2,
  text: "Community review",
  is_own_review: false,
} as BusinessReview;

function mockReviews(reviews: BusinessReview[]) {
  (useBusinessReviews as jest.Mock).mockReturnValue({
    reviews,
    isInitialLoading: false,
    isRefetching: false,
    error: null,
    refetch: jest.fn(),
    totalCount: reviews.length,
  });
}

describe("ExploreBusinessReviewsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("offers an eligible Explorer an inline review composer action", async () => {
    mockReviews([communityReview]);
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    fireEvent.press(screen.getByText("Write a review"));

    expect(presentBottomSheet).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Manage My Business")).toBeNull();
  });

  it("keeps an own review editable without offering duplicate creation", async () => {
    mockReviews([ownReview, communityReview]);
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getByText("My Review")).toBeTruthy();
    expect(screen.queryByText("Write a review")).toBeNull();
    fireEvent.press(screen.getByLabelText("Edit review 1"));
    expect(presentBottomSheet).toHaveBeenCalledTimes(1);
  });

  it("keeps owner management access without a review creation action", async () => {
    mockReviews([communityReview]);
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness />,
    );

    expect(screen.getByText("Manage My Business")).toBeTruthy();
    expect(screen.queryByText("Write a review")).toBeNull();
  });

  it("offers Write a review inside the eligible empty state", async () => {
    mockReviews([]);
    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getByText("No reviews yet")).toBeTruthy();
    fireEvent.press(screen.getByText("Write a review"));
    expect(presentBottomSheet).toHaveBeenCalledTimes(1);
  });

  it("preserves the reviews loading state", async () => {
    (useBusinessReviews as jest.Mock).mockReturnValue({
      reviews: [],
      isInitialLoading: true,
      isRefetching: false,
      error: null,
      refetch: jest.fn(),
      totalCount: 0,
    });

    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    expect(screen.getByText("Reviews loading")).toBeTruthy();
  });

  it("preserves persistent review error recovery", async () => {
    const refetch = jest.fn();
    (useBusinessReviews as jest.Mock).mockReturnValue({
      reviews: [],
      isInitialLoading: false,
      isRefetching: false,
      error: new Error("reviews unavailable"),
      refetch,
      totalCount: 0,
    });

    const screen = await render(
      <ExploreBusinessReviewsScreen businessId={20} isOwnBusiness={false} />,
    );

    fireEvent.press(screen.getByText("Retry"));
    expect(refetch).toHaveBeenCalled();
  });
});
