import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { useReviewLike } from "@/features/explore/hooks/useReviewLike";
import { resolveAvatarSource } from "@/shared/constants/avatars";

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
jest.mock("expo-image", () => ({
  Image: ({ source, ...props }: { source: { uri?: string } }) => {
    const { View } = jest.requireActual("react-native");

    return (
      <View
        {...props}
        source={source}
        testID={`mock-image:${source?.uri ?? "builtin"}`}
      />
    );
  },
}));
jest.mock("@/features/explore/hooks/useReviewLike", () => ({
  useReviewLike: jest.fn(),
}));
jest.mock("@/shared/components/modals/FullScreenPhotoViewer", () => ({
  __esModule: true,
  default: ({
    visible,
    onClose,
  }: {
    visible: boolean;
    onClose: () => void;
  }) => {
    const { Pressable } = jest.requireActual("react-native");

    return visible ? (
      <Pressable
        testID="fullscreen-photo-viewer"
        accessibilityRole="button"
        accessibilityLabel="Close photo viewer"
        onPress={onClose}
      />
    ) : null;
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
      params: { businessId: "12", profileSource: "COMMUNITY" },
    });
  });

  it("expands and collapses long review text", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);
    const reviewText = screen.getByText(baseReview.text);

    fireEvent(reviewText, "textLayout", {
      nativeEvent: { lines: Array.from({ length: 6 }, () => ({})) },
    });
    const readMore = await screen.findByLabelText("Read full review");
    expect(screen.getByText(baseReview.text).props.numberOfLines).toBe(5);

    fireEvent.press(readMore);
    await waitFor(() => {
      expect(
        screen.getByText(baseReview.text).props.numberOfLines,
      ).toBeUndefined();
    });
    fireEvent.press(screen.getByLabelText("Show less of review"));
    await waitFor(() => {
      expect(screen.getByText(baseReview.text).props.numberOfLines).toBe(5);
    });
  });

  it("opens review photos in the established fullscreen viewer", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    fireEvent.press(screen.getByLabelText("View review photo 1 of 1"));

    await waitFor(() => {
      expect(screen.getByTestId("fullscreen-photo-viewer")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Close photo viewer"));
    await waitFor(() => {
      expect(screen.queryByTestId("fullscreen-photo-viewer")).toBeNull();
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

    fireEvent.press(screen.getByLabelText("View owner response photo 1"));
    await waitFor(() => {
      expect(screen.getByTestId("fullscreen-photo-viewer")).toBeTruthy();
    });
    expect(screen.getByLabelText("Collapse owner response")).toBeTruthy();
  });

  it("shows the full merchant response when expanded", async () => {
    const longResponse = "Thank you for visiting. ".repeat(25);
    const screen = await render(
      <CommunityReviewCard
        review={{
          ...baseReview,
          reply: {
            id: 6,
            text: longResponse,
            created_at: "2026-10-12T09:00:00Z",
            updated_at: "2026-10-12T09:00:00Z",
            photos: [],
          },
        }}
      />,
    );

    const expand = screen.getByLabelText("Expand owner response");
    expect(expand.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(expand);

    const collapse = await screen.findByLabelText("Collapse owner response");
    expect(collapse.props.accessibilityState).toEqual({ expanded: true });
    expect(screen.getByText(longResponse).props.numberOfLines).toBeUndefined();
  });

  it("delegates helpful feedback to the shared cache mutation", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    fireEvent.press(screen.getByLabelText("Mark review helpful"));

    expect(mockLike).toHaveBeenCalledWith({ reviewId: 9, isLiked: false });
  });

  it("does not expose public comment or reply actions", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    expect(screen.queryByText(/comments?/i)).toBeNull();
    expect(screen.queryByLabelText(/reply/i)).toBeNull();
  });

  it("offers manual recovery for failed review photos and resets on URL changes", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);
    const photo = screen.getByTestId(
      `mock-image:${baseReview.photos[0].photo_url}`,
    );

    await fireEvent(photo, "error", { error: "Unavailable" });
    expect(screen.queryByLabelText("View review photo 1 of 1")).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByLabelText("View review photo 1 of 1")).toBeTruthy();

    const retriedPhoto = screen.getByTestId(
      `mock-image:${baseReview.photos[0].photo_url}`,
    );
    await fireEvent(retriedPhoto, "error", { error: "Still unavailable" });
    await screen.rerender(
      <CommunityReviewCard
        review={{
          ...baseReview,
          photos: [{ id: 30, photo_url: "https://example.com/replaced.jpg" }],
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    expect(screen.getByLabelText("View review photo 1 of 1")).toBeTruthy();
  });

  it("falls back from failed business thumbnails and tries replacement URLs", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);
    const thumbnail = screen.getByTestId(
      `mock-image:${baseReview.business.display_cover_photo_url}`,
    );
    await fireEvent(thumbnail, "error", { error: "Unavailable" });
    expect(
      screen.queryByTestId(
        `mock-image:${baseReview.business.display_cover_photo_url}`,
      ),
    ).toBeNull();
    expect(
      screen.getByLabelText("Open Sugbo Kitchen business profile"),
    ).toBeTruthy();

    const replacementUrl = "https://example.com/replaced-cover.jpg";
    await screen.rerender(
      <CommunityReviewCard
        review={{
          ...baseReview,
          business: {
            ...baseReview.business,
            display_cover_photo_url: replacementUrl,
          },
        }}
      />,
    );
    expect(screen.getByTestId(`mock-image:${replacementUrl}`)).toBeTruthy();
  });

  it("falls back to the built-in avatar when a remote avatar fails", async () => {
    const avatarUrl = "https://example.com/avatar.jpg";
    const review = {
      ...baseReview,
      author: { ...baseReview.author, avatar_url: avatarUrl },
    };
    const screen = await render(<CommunityReviewCard review={review} />);
    const avatar = screen.getByTestId(`mock-image:${avatarUrl}`);
    await fireEvent(avatar, "error", { error: "Unavailable" });
    expect(screen.getByTestId("mock-image:builtin").props.source).toBe(
      resolveAvatarSource(review.author.avatar_key),
    );

    const replacementUrl = "https://example.com/replaced-avatar.jpg";
    await screen.rerender(
      <CommunityReviewCard
        review={{
          ...review,
          author: { ...review.author, avatar_url: replacementUrl },
        }}
      />,
    );
    expect(screen.getByTestId(`mock-image:${replacementUrl}`)).toBeTruthy();
  });
});
