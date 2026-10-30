import { render } from "@testing-library/react-native";
import colors from "tailwindcss/colors";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import BusinessSentimentRating from "../components/business-profile/BusinessSentimentRating";
import BusinessCard from "../components/new-businesses/BusinessCard";
import type { ExploreBusiness } from "../types/exploreBusiness.types";
import { exploreBusinessDetailKey } from "../hooks/reviewQueryKeys";
import type { BusinessSentimentRating as Rating } from "../types/businessRating.types";
import {
  businessRatingAccessibilityLabel,
  hasDisplayableBusinessRating,
} from "../utils/businessRating.utils";
import {
  beginBusinessRatingSync,
  guardBusinessRating,
  observeBusinessRating,
  shouldPollBusinessRating,
} from "../hooks/businessRatingSync";
import { businessRatingSchema } from "../persistence/businessRatingSchema";
import { EXPLORE_HOMEPAGE_PERSISTENCE_POLICIES } from "../persistence/exploreHomepagePolicies";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return {
    MaterialCommunityIcons: function MockIcon(props: object) {
      return <View testID="rating-icon" {...props} />;
    },
  };
});

export const ratingFixture: Rating = {
  value: 4.2,
  contributing_review_count: 7,
  state: "ready",
  experimental: true,
  provenance: "legacy_unverified",
  scoring_version: "legacy-unverified-v1",
  calculation_version: "signed-average-v1",
  computed_at: "2026-10-30T00:00:00Z",
  automatic_updates_enabled: true,
};

describe("experimental business rating", () => {
  beforeEach(() => {
    onlineManager.setOnline(true);
    useAuthStore.setState({ user: { id: 10 } as never, isAuthenticated: true });
  });

  it("uses the server rating and scored count with an accessible AI disclosure", async () => {
    const screen = await render(
      <BusinessSentimentRating businessId={1} rating={ratingFixture} />,
    );
    expect(screen.getByText("4.2/5 · 7 scored reviews")).toBeTruthy();
    expect(screen.getByText("AI sentiment · Experimental")).toBeTruthy();
    expect(
      screen.getByLabelText(
        /AI-derived sentiment rating 4.2 out of 5, based on 7 scored reviews/,
      ),
    ).toBeTruthy();
  });

  it.each([1, 2.8, 4.5, 5])(
    "presents compact rating %s with the same filled gold star and descriptive accessibility",
    async (value) => {
      const screen = await render(
        <BusinessSentimentRating
          businessId={1}
          rating={{ ...ratingFixture, value }}
          compact
        />,
      );
      expect(screen.getByText(`${value.toFixed(1)} (7)`)).toBeTruthy();
      const star = screen.getByTestId("rating-icon", {
        includeHiddenElements: true,
      });
      expect(star.props.name).toBe("star");
      expect(star.props.color).toBe(colors.amber[500]);
      expect(star.props.accessible).toBe(false);
      expect(
        screen.queryByText(/AI sentiment|Experimental|\/5|scored reviews/),
      ).toBeNull();
      expect(
        screen.getByLabelText(
          new RegExp(
            `rating ${value.toFixed(1)} out of 5, based on 7 scored reviews`,
          ),
        ),
      ).toBeTruthy();
    },
  );

  it.each([
    { state: "insufficient_data" as const, contributing_review_count: 4 },
    { state: "ready" as const, contributing_review_count: 4 },
    { state: "pending" as const },
    { state: "unavailable" as const },
  ])(
    "reserves no compact row for an unavailable numeric rating (%s)",
    async (overrides) => {
      const screen = await render(
        <BusinessSentimentRating
          businessId={1}
          rating={{ ...ratingFixture, ...overrides }}
          compact
        />,
      );
      expect(screen.toJSON()).toBeNull();
    },
  );

  it.each(["pending", "unavailable", "insufficient_data"] as const)(
    "suppresses stale numeric data in %s state",
    async (state) => {
      const screen = await render(
        <BusinessSentimentRating
          businessId={1}
          rating={{ ...ratingFixture, state, contributing_review_count: 4 }}
        />,
      );
      expect(screen.queryByText(/4.2\/5/)).toBeNull();
      expect(screen.getByText("AI sentiment · Experimental")).toBeTruthy();
    },
  );

  it("does not infer a rating below the minimum even if a ready value is supplied", () => {
    expect(
      hasDisplayableBusinessRating({
        ...ratingFixture,
        contributing_review_count: 4,
      }),
    ).toBe(false);
    expect(hasDisplayableBusinessRating({ ...ratingFixture, value: NaN })).toBe(
      false,
    );
    expect(
      hasDisplayableBusinessRating({ ...ratingFixture, computed_at: null }),
    ).toBe(false);
    expect(
      businessRatingAccessibilityLabel({
        ...ratingFixture,
        state: "insufficient_data",
        value: null,
        contributing_review_count: 4,
      }),
    ).toContain("4 scored reviews; at least five required");
  });

  it.each([undefined, null])(
    "omits disabled or missing exposure (%s)",
    async (rating) => {
      const screen = await render(
        <BusinessSentimentRating businessId={1} rating={rating} />,
      );
      expect(screen.toJSON()).toBeNull();
    },
  );

  it("does not present a numeric rating when refresh fails", async () => {
    const screen = await render(
      <BusinessSentimentRating
        businessId={1}
        rating={ratingFixture}
        networkError
      />,
    );
    expect(screen.queryByText(/4.2\/5/)).toBeNull();
    expect(screen.getByText("Rating could not refresh")).toBeTruthy();
  });

  it("suppresses offline numeric data", async () => {
    onlineManager.setOnline(false);
    const screen = await render(
      <BusinessSentimentRating businessId={1} rating={ratingFixture} />,
    );
    expect(screen.queryByText(/4.2\/5/)).toBeNull();
    expect(screen.getByText("Rating unavailable")).toBeTruthy();
  });

  it("guards old receipts through bounded observation and remembers newer receipts", () => {
    const client = new QueryClient();
    beginBusinessRatingSync(client, 1, ratingFixture);
    expect(guardBusinessRating(client, 1, ratingFixture)?.state).toBe(
      "pending",
    );
    expect(observeBusinessRating(client, 1, ratingFixture)).toBe(false);
    const fresh = { ...ratingFixture, computed_at: "2026-10-30T00:00:10Z" };
    expect(observeBusinessRating(client, 1, fresh)).toBe(true);
    expect(guardBusinessRating(client, 1, fresh)?.value).toBe(4.2);
    expect(guardBusinessRating(client, 1, ratingFixture)?.value).toBeNull();
    expect(observeBusinessRating(client, 1, ratingFixture)).toBe(false);
    client.clear();
  });

  it("does not carry observation across accounts", () => {
    const client = new QueryClient();
    beginBusinessRatingSync(client, 1, ratingFixture);
    useAuthStore.setState({ user: { id: 99 } as never });
    expect(guardBusinessRating(client, 1, ratingFixture)?.state).toBe("ready");
    client.clear();
  });

  it("does not lower the receipt floor when another mutation starts from older data", () => {
    const client = new QueryClient();
    const newer = { ...ratingFixture, computed_at: "2026-10-30T00:00:30Z" };
    client.setQueryData(exploreBusinessDetailKey(1), {
      id: 1,
      sentiment_rating: newer,
    });
    beginBusinessRatingSync(client, 1, ratingFixture);
    expect(observeBusinessRating(client, 1, newer)).toBe(false);
    expect(guardBusinessRating(client, 1, newer)?.value).toBeNull();
    client.clear();
  });

  it.each(["default", "featured", "compact"] as const)(
    "shows only the compact contributing count on rated %s cards",
    async (variant) => {
      const business: ExploreBusiness = {
        id: 1,
        business_name: "Rating Cafe",
        cover_photo_url: null,
        display_cover_photo_url: null,
        review_count: 100,
        overall_vibe: null,
        is_pocketed: false,
        cluster: { id: 1, name: "Food", icon: "food" },
        category: { id: 1, name: "Cafe" },
        specialty_tags: [],
        location: {
          address: "Cebu",
          city: "Cebu",
          province: "Cebu",
          latitude: 10,
          longitude: 123,
        },
        sentiment_rating: ratingFixture,
      };
      const screen = await render(
        <BusinessCard
          business={business}
          variant={variant}
          distance={null}
          distanceAccuracy={null}
          onPress={jest.fn()}
        />,
      );
      expect(screen.getByText("4.2 (7)")).toBeTruthy();
      expect(
        screen.getByRole("button", {
          name: /Open Rating Cafe.*AI-derived sentiment rating 4.2 out of 5/,
        }),
      ).toBeTruthy();
      expect(screen.queryByText("100 reviews")).toBeNull();
      expect(
        screen.queryByText(/AI sentiment|Experimental|\/5|scored reviews/),
      ).toBeNull();
    },
  );

  it("bounds windows and avoids polling completed passive observations", () => {
    expect(
      shouldPollBusinessRating({
        baseline: null,
        startedAt: Date.now() - 120_001,
        completedAt: null,
        watchWindow: true,
      }),
    ).toBe(false);
    expect(
      shouldPollBusinessRating({
        baseline: null,
        startedAt: Date.now(),
        completedAt: ratingFixture.computed_at,
        watchWindow: false,
      }),
    ).toBe(false);
  });

  it("validates the exact persisted contract while stripping unsupported metadata", () => {
    expect(
      businessRatingSchema.parse({ ...ratingFixture, private_revision: 99 }),
    ).toEqual(ratingFixture);
    const policy = EXPLORE_HOMEPAGE_PERSISTENCE_POLICIES.find(
      (item) => item.id === "explore-new-businesses",
    )!;
    const business = {
      id: 1,
      business_name: "Cafe",
      cover_photo_url: null,
      display_cover_photo_url: null,
      review_count: 100,
      overall_vibe: null,
      is_pocketed: false,
      cluster: { id: 1, name: "Food", icon: "food" },
      category: { id: 1, name: "Cafe" },
      specialty_tags: [],
      location: {
        address: "Cebu",
        city: "Cebu",
        province: "Cebu",
        latitude: 10,
        longitude: 123,
      },
    };
    const feed = (item: unknown) => ({
      items: [item],
      pagination: {
        page: 1,
        page_size: 10,
        total_items: 1,
        total_pages: 1,
        has_next: false,
        has_previous: false,
      },
    });
    const old = policy.parse(feed(business)) as {
      items: Array<{ sentiment_rating?: Rating }>;
    };
    expect(old.items[0].sentiment_rating).toBeUndefined();
    const current = policy.parse(
      feed({ ...business, sentiment_rating: ratingFixture }),
    ) as { items: Array<{ sentiment_rating: Rating }> };
    expect(current.items[0].sentiment_rating).toEqual(ratingFixture);
  });
});
