import { fireEvent, render } from "@testing-library/react-native";

import { useBusinessReviewPreview } from "../../../../hooks/useBusinessReviews";
import type { BusinessReviewInsights } from "../../../../types/exploreBusiness.types";
import type { BusinessReview } from "../../../../types/review.types";
import BusinessReviewsSection from "../review-preview-section/BusinessReviewsPreviewSection";

jest.setTimeout(15_000);

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

const reviewInsights: BusinessReviewInsights = {
  state: "ready",
  state_message: "Review insights are ready.",
  content_available: true,
  narrative: "Customers have mixed opinions about service and value.",
  review_count: 6,
  eligible_review_count: 5,
  analyzed_review_count: 5,
  classified_review_count: 5,
  has_sufficient_sentiment_data: true,
  overall_vibe: "mostly_negative",
  is_sampled: false,
  sentiment: {
    positive: { count: 1, percentage: 20 },
    neutral: { count: 1, percentage: 20 },
    negative: { count: 3, percentage: 60 },
  },
  frequent_mentions: [{ label: "Slow service", count: 3 }],
  coverage_start: null,
  coverage_end: null,
  generated_at: null,
  updated_at: null,
};

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

  it("shows only the compact recent-insights takeaway in the profile preview", async () => {
    mockPreview([review]);
    const screen = await render(
      <BusinessReviewsSection
        {...defaultProps}
        reviewInsights={reviewInsights}
      />,
    );

    expect(screen.getByText("Recent Review Insights")).toBeTruthy();
    expect(screen.getByText("Mostly negative")).toBeTruthy();
    expect(
      screen.getByText(
        "Based on 5 eligible reviews from the past 30 days.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Vibe Summary")).toBeTruthy();
    expect(screen.getByText("AI-generated")).toBeTruthy();
    expect(screen.getByText(reviewInsights.narrative!)).toBeTruthy();
    expect(screen.queryByText("Recent Sentiment")).toBeNull();
    expect(screen.queryByText("Positive")).toBeNull();
    expect(screen.queryByText("Frequently mentioned")).toBeNull();
    expect(screen.queryByText("Slow service · 3")).toBeNull();
  });

  it("keeps retained outdated summary content visible in the compact preview", async () => {
    mockPreview([review]);
    const screen = await render(
      <BusinessReviewsSection
        {...defaultProps}
        reviewInsights={{
          ...reviewInsights,
          state: "outdated",
          state_message: "Review insights are outdated and awaiting refresh.",
        }}
      />,
    );

    expect(screen.getByText(reviewInsights.narrative!)).toBeTruthy();
    expect(screen.getByText(/outdated and awaiting refresh/i)).toBeTruthy();
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
    expect(
      existingReviewScreen.queryByText(/already reviewed this business/i),
    ).toBeNull();

    const ownerScreen = await render(
      <BusinessReviewsSection {...defaultProps} isOwnBusiness />,
    );
    expect(ownerScreen.queryByText("Write a review")).toBeNull();
  });
});
