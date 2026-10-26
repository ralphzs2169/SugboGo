import {
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react-native";

import { useReviewLike } from "@/features/explore/hooks/useReviewLike";
import MerchantReviewResponse from "@/features/explore/components/business-profile/reviews/MerchantReviewResponse";
import { resolveAvatarSource } from "@/shared/constants/avatars";

import CommunityReviewCardComponent from "../CommunityReviewCard";
import type { CommunityReview } from "../../types/communityReview.types";

const mockOpenBusiness = jest.fn();
const mockLike = jest.fn(async () => undefined);

jest.mock("expo-router", () => ({
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
    photos,
  }: {
    visible: boolean;
    onClose: () => void;
    photos: { uri: string; accessibilityLabel?: string }[];
  }) => {
    const { Pressable, View } = jest.requireActual("react-native");

    return visible ? (
      <View testID="fullscreen-photo-viewer">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close photo viewer"
          onPress={onClose}
        />
        {photos.map((photo) => (
          <View
            key={photo.uri}
            accessible
            accessibilityRole="image"
            accessibilityLabel={photo.accessibilityLabel}
          />
        ))}
      </View>
    ) : null;
  },
}));

function CommunityReviewCard({ review }: { review: CommunityReview }) {
  return (
    <CommunityReviewCardComponent
      review={review}
      onOpenBusiness={mockOpenBusiness}
    />
  );
}

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

    expect(mockOpenBusiness).toHaveBeenCalledWith(baseReview.business);
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
    expect(
      screen.getByRole("image", { name: "Review photo 1 of 1" }),
    ).toBeTruthy();

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

    expect(
      screen.queryByLabelText("View merchant response photo 1 of 1"),
    ).toBeNull();
    fireEvent.press(screen.getByLabelText("Expand owner response"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("View merchant response photo 1 of 1"),
      ).toBeTruthy();
    });

    const collapse = screen.getByLabelText("Collapse owner response");
    expect(within(collapse).queryByText(review.reply.text)).toBeNull();
    expect(
      within(collapse).queryByLabelText("View merchant response photo 1 of 1"),
    ).toBeNull();
    expect(screen.getByText(review.reply.text).props.accessible).toBe(true);
    await fireEvent.press(
      screen.getByLabelText("View merchant response photo 1 of 1"),
    );
    await waitFor(() => {
      expect(screen.getByTestId("fullscreen-photo-viewer")).toBeTruthy();
    });
    expect(screen.getByLabelText("Collapse owner response")).toBeTruthy();
    expect(
      screen.getByRole("image", { name: "Merchant response photo 1 of 1" }),
    ).toBeTruthy();
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

  it("keeps merchant-perspective response content independent of its toggle", async () => {
    const reply = {
      id: 6,
      text: "Thank you for visiting us!",
      created_at: "2026-10-12T09:00:00Z",
      updated_at: "2026-10-12T09:00:00Z",
      photos: [],
    };
    const screen = await render(
      <MerchantReviewResponse reply={reply} perspective="merchant" />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Expand owner response" }),
    );

    expect(screen.getByText("Your response")).toBeTruthy();
    expect(screen.getByText(reply.text).props.accessible).toBe(true);
    const toggle = screen.getByRole("button", {
      name: "Collapse owner response",
    });
    expect(toggle.props.accessibilityState).toEqual({ expanded: true });
    expect(within(toggle).queryByText(reply.text)).toBeNull();
    await fireEvent.press(toggle);
    expect(
      screen.getByRole("button", { name: "Expand owner response" }),
    ).toBeTruthy();
  });

  it("delegates helpful feedback to the shared cache mutation", async () => {
    const screen = await render(<CommunityReviewCard review={baseReview} />);

    await fireEvent.press(
      screen.getByLabelText("Mark review helpful, 3 helpful"),
    );

    expect(mockLike).toHaveBeenCalledWith({ reviewId: 9, isLiked: false });
  });

  it("exposes Helpful count, selection and pending state while retaining merchant context", async () => {
    (useReviewLike as jest.Mock).mockReturnValue({
      mutateAsync: mockLike,
      isPending: true,
    });
    const screen = await render(
      <CommunityReviewCard
        review={{ ...baseReview, is_liked: true, like_count: 1234567 }}
      />,
    );
    const helpful = screen.getByRole("button", {
      name: "Remove helpful, 1234567 helpful",
      disabled: true,
    });
    expect(helpful.props.accessibilityState).toEqual({
      selected: true,
      disabled: true,
      busy: true,
    });
    expect(screen.getByText("1234567 helpful")).toBeTruthy();
    expect(screen.getByText("Liked by merchant")).toBeTruthy();
    await fireEvent.press(helpful);
    expect(mockLike).not.toHaveBeenCalled();
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
