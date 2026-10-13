import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { useReviewLike } from "@/features/explore/hooks/useReviewLike";

import CommunityReviewCard from "../CommunityReviewCard";
import type { CommunityReview } from "../../types/communityReview.types";

const mockPush = jest.fn();
const mockLike = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));
jest.mock("@/features/explore/hooks/useReviewLike", () => ({
  useReviewLike: jest.fn(),
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: ({ visible }: { visible: boolean }) => {
    const { View } = jest.requireActual("react-native");

    return visible ? <View testID="fullscreen-photo-viewer" /> : null;
  },
}));

const baseReview: CommunityReview = {
  id: 9,
  text: "Warm service and a genuinely local experience.",
  like_count: 3,
  created_at: "2026-10-12T08:00:00Z",
  updated_at: "2026-10-12T08:00:00Z",
  is_liked: false,
  is_liked_by_owner: true,
  is_own_review: false,
  author: {
    id: 4,
    first_name: "Ana",
    last_name: "Cruz",
    role: "explorer",
    avatar_url: null,
    avatar_key: "explorer_avatar_1",
  },
  photos: [{ id: 30, photo_url: "https://example.com/review.jpg" }],
  vouched_specialties: [
    {
      id: 2,
      name: "Local Flavors",
      color: "green",
      icon: "utensils",
    },
  ],
  reply: null,
  business: {
    id: 12,
    business_name: "Sugbo Kitchen",
    display_cover_photo_url: "https://example.com/business.jpg",
    category: { id: 5, name: "Restaurant" },
    address: "Gorordo Avenue, Cebu City",
  },
};

describe("CommunityReviewCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useReviewLike as jest.Mock).mockReturnValue({
      mutateAsync: mockLike,
      isPending: false,
    });
  });

  it("renders public review content and navigates through the business row", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    expect(screen.getByText("Ana Cruz")).toBeTruthy();
    expect(screen.getByText(baseReview.text)).toBeTruthy();
    expect(screen.getByText("Sugbo Kitchen")).toBeTruthy();
    expect(screen.getByText("Local Flavors")).toBeTruthy();

    fireEvent.press(
      screen.getByLabelText("Open Sugbo Kitchen business profile"),
    );

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(explorer)/business/[businessId]",
      params: { businessId: "12" },
    });
  });

  it("opens review photos in the established fullscreen viewer", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    fireEvent.press(screen.getByLabelText("View review photo 1"));

    await waitFor(() => {
      expect(screen.getByTestId("fullscreen-photo-viewer")).toBeTruthy();
    });
  });

  it("expands a merchant response and preserves its photos", async () => {
    const review = {
      ...baseReview,
      reply: {
        id: 6,
        text: "Thank you for visiting us!",
        created_at: "2026-10-12T09:00:00Z",
        updated_at: "2026-10-12T09:00:00Z",
        photos: [{ id: 41, photo_url: "https://example.com/response.jpg" }],
      },
    };
    const screen = await render(<CommunityReviewCard review={review} />);

    expect(screen.queryByLabelText("View owner response photo 1")).toBeNull();
    fireEvent.press(screen.getByLabelText("Expand owner response"));

    await waitFor(() => {
      expect(screen.getByLabelText("View owner response photo 1")).toBeTruthy();
    });
  });

  it("provides immediate helpful feedback through the existing mutation", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    fireEvent.press(screen.getByLabelText("Mark review helpful"));

    await waitFor(() => expect(screen.getByText("4 helpful")).toBeTruthy());
    expect(mockLike).toHaveBeenCalledWith({ reviewId: 9, isLiked: false });
  });

  it("does not expose public comment or reply actions", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    expect(screen.queryByText(/comments?/i)).toBeNull();
    expect(screen.queryByLabelText(/reply/i)).toBeNull();
  });
});
