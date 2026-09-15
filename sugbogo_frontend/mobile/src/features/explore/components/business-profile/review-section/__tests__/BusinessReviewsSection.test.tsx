import { fireEvent, render } from "@testing-library/react-native";

import { useBusinessReviewPreview } from "../../../../hooks/useBusinessReviews";
import type { BusinessReview } from "../../../../types/review.types";
import BusinessReviewsSection from "../BusinessReviewsSection";

jest.mock("expo-router", () => ({
  router: { push: jest.fn() },
}));
jest.mock("../../../../hooks/useBusinessReviews");
jest.mock("../BusinessReviewCard", () => ({
  __esModule: true,
  default: ({ review }: { review: BusinessReview }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Text } = require("react-native");

    return <Text>{review.text}</Text>;
  },
}));

const review = {
  id: 2,
  text: "Helpful review",
  is_own_review: false,
} as BusinessReview;

const defaultProps = {
  businessId: 20,
  businessName: "Sugbo Cafe",
  isOwnBusiness: false,
  hasOwnReview: false,
  onWriteReview: jest.fn(),
  onEditReview: jest.fn(),
};

function mockPreview(reviews: BusinessReview[]) {
  (useBusinessReviewPreview as jest.Mock).mockReturnValue({
    reviews,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    totalCount: reviews.length,
    hasOwnReview: reviews.some((item) => item.is_own_review),
  });
}

describe("BusinessReviewsSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("places Write a review inline with an eligible review preview", async () => {
    mockPreview([review]);
    const screen = await render(<BusinessReviewsSection {...defaultProps} />);

    fireEvent.press(screen.getByText("Write a review"));

    expect(defaultProps.onWriteReview).toHaveBeenCalled();
  });

  it("offers the same action in the eligible empty state", async () => {
    mockPreview([]);
    const screen = await render(<BusinessReviewsSection {...defaultProps} />);

    expect(screen.getByText("No reviews yet")).toBeTruthy();
    expect(screen.getByText("Write a review")).toBeTruthy();
  });

  it("does not offer duplicate or owner review creation", async () => {
    mockPreview([review]);
    const existingReviewScreen = await render(
      <BusinessReviewsSection {...defaultProps} hasOwnReview />,
    );
    expect(existingReviewScreen.queryByText("Write a review")).toBeNull();

    const ownerScreen = await render(
      <BusinessReviewsSection {...defaultProps} isOwnBusiness />,
    );
    expect(ownerScreen.queryByText("Write a review")).toBeNull();
  });
});
