import { fireEvent, render } from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import * as Native from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import type { BusinessSentimentRating } from "../../../types/businessRating.types";
import { beginBusinessRatingSync } from "../../../hooks/businessRatingSync";
import BusinessCard from "../BusinessCard";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

const rating: BusinessSentimentRating = {
  value: 2.8,
  contributing_review_count: 5,
  state: "ready",
  experimental: true,
  provenance: "legacy_unverified",
  scoring_version: "legacy-unverified-v1",
  calculation_version: "signed-average-v1",
  computed_at: "2026-10-30T00:00:00Z",
  automatic_updates_enabled: true,
};
const business: ExploreBusiness = {
  id: 12,
  business_name: "Local Coffee",
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 12,
  overall_vibe: "mostly_positive",
  is_pocketed: false,
  cluster: { id: 2, name: "Culinary", icon: "utensils" },
  category: { id: 8, name: "Cafe" },
  specialty_tags: [
    "Specialty Coffee",
    "Local Pastries",
    "Breakfast",
    "Outdoor Dining",
  ].map((name, index) => ({
    id: index + 1,
    name,
    color: "blue",
    icon: "coffee",
    vouch_count: index,
    is_vouched: index === 0,
  })),
  sentiment_rating: rating,
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
};

beforeEach(() => {
  onlineManager.setOnline(true);
  useAuthStore.setState({ user: { id: 10 } as never, isAuthenticated: true });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe.each(["default", "featured", "compact"] as const)(
  "%s card preview",
  (variant) => {
    it("announces the visible rating once through the profile button, then falls back to published reviews", async () => {
      const renderCard = (snapshot: BusinessSentimentRating) => (
        <BusinessCard
          business={{ ...business, sentiment_rating: snapshot }}
          variant={variant}
          distance={1200}
          distanceAccuracy={null}
          recommendationReason={{
            type: "specialty_tag",
            id: 1,
            label: "Coffee",
          }}
          onPress={jest.fn()}
        />
      );
      const view = await render(renderCard(rating));
      const card = view.getByRole("button", { name: /Open Local Coffee/ });
      expect(card.props.accessibilityLabel).toContain(
        "2.8 out of 5, based on 5 scored reviews",
      );
      expect(card.props.accessibilityLabel).not.toContain("12 reviews");
      expect(card.props.accessibilityLabel).toContain("Cafe");
      expect(card.props.accessibilityLabel).toContain("Specialty Coffee");
      if (variant === "compact") {
        expect(card.props.accessibilityLabel).toContain("Related to Coffee");
      }
      expect(view.getAllByLabelText(/sentiment rating/)).toHaveLength(1);

      await view.rerender(renderCard({ ...rating, state: "pending" }));
      expect(view.queryByText("2.8 (5)")).toBeNull();
      expect(view.getByText("12 reviews")).toBeTruthy();
      expect(view.queryByLabelText(/rating/i)).toBeNull();

      await view.rerender(renderCard(rating));
      expect(view.getByText("2.8 (5)")).toBeTruthy();
      expect(view.queryByText("12 reviews")).toBeNull();
      expect(view.getAllByLabelText(/sentiment rating/)).toHaveLength(1);
    });

    it("announces the visible zero-review state without a hidden rating", async () => {
      const view = await render(
        <BusinessCard
          business={{ ...business, review_count: 0, sentiment_rating: null }}
          variant={variant}
          distance={null}
          distanceAccuracy={null}
          onPress={jest.fn()}
        />,
      );
      expect(view.getByText("No reviews yet")).toBeTruthy();
      expect(view.getByRole("button", { name: /No reviews yet/ })).toBeTruthy();
      expect(view.queryByLabelText(/rating/i)).toBeNull();
    });

    it.each([0, 1, 2, 3, 4])(
      "preserves the existing preview for %s supplied specialties without changing their data",
      async (count) => {
        const specialties = business.specialty_tags.slice(0, count);
        const original = JSON.stringify(specialties);
        const view = await render(
          <BusinessCard
            business={{ ...business, specialty_tags: specialties }}
            variant={variant}
            distance={null}
            distanceAccuracy={null}
            onPress={jest.fn()}
          />,
        );
        const visibleSpecialties =
          variant === "compact" ? specialties : specialties.slice(0, 3);
        visibleSpecialties.forEach((tag) => {
          expect(view.getByText(tag.name)).toBeTruthy();
        });
        specialties.slice(visibleSpecialties.length).forEach((tag) => {
          expect(view.queryByText(tag.name)).toBeNull();
        });
        expect(view.queryByText(/^\+\d+$/)).toBeNull();
        expect(JSON.stringify(specialties)).toBe(original);
      },
    );

    it.each([
      undefined,
      null,
      "insufficient_data",
      "pending",
      "unavailable",
    ] as const)(
      "omits rating placeholders and keeps ordinary metadata when rating is %s",
      async (state) => {
        const snapshot =
          typeof state === "string"
            ? { ...rating, state, value: null, contributing_review_count: 4 }
            : state;
        const view = await render(
          <BusinessCard
            business={{ ...business, sentiment_rating: snapshot }}
            variant={variant}
            distance={null}
            distanceAccuracy={null}
            onPress={jest.fn()}
          />,
        );
        expect(
          view.queryByText(
            /2.8|AI sentiment|Experimental|Not enough|Rating updating|Rating unavailable/,
          ),
        ).toBeNull();
        expect(view.getByText("12 reviews")).toBeTruthy();
        expect(view.queryByText("Mostly positive")).toBeNull();
        const card = view.getByRole("button", { name: /Open Local Coffee/ });
        expect(card.props.accessibilityLabel).toContain("12 reviews");
        expect(card.props.accessibilityLabel).not.toMatch(
          /rating|scored|Experimental|pending|insufficient|unavailable/i,
        );
      },
    );

    it("keeps the name, all specialties, rating and navigation available at a narrow width", async () => {
      jest.spyOn(Native, "useWindowDimensions").mockReturnValue({
        width: 320,
        height: 640,
        scale: 1,
        fontScale: 1.5,
      });
      const name =
        "A very long local business name with specialty coffee and handmade pastries";
      const onPress = jest.fn();
      const view = await render(
        <BusinessCard
          business={{ ...business, business_name: name }}
          variant={variant}
          distance={null}
          distanceAccuracy={null}
          onPress={onPress}
        />,
      );
      expect(view.getByText(name).props.numberOfLines).toBe(2);
      expect(view.getByText("2.8 (5)")).toBeTruthy();
      const visibleSpecialties =
        variant === "compact"
          ? business.specialty_tags
          : business.specialty_tags.slice(0, 3);
      visibleSpecialties.forEach((tag) => {
        expect(view.getByText(tag.name)).toBeTruthy();
      });
      expect(view.queryByText("12 reviews")).toBeNull();
      await fireEvent.press(
        view.getByRole("button", { name: /Open A very long local business/ }),
      );
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("uses the existing observation guard to withdraw a stale card value", async () => {
      const client = new QueryClient();
      beginBusinessRatingSync(client, business.id, rating);
      const view = await render(
        <QueryClientProvider client={client}>
          <BusinessCard
            business={business}
            variant={variant}
            distance={null}
            distanceAccuracy={null}
            onPress={jest.fn()}
          />
        </QueryClientProvider>,
      );
      expect(view.queryByText("2.8 (5)")).toBeNull();
      expect(view.queryByText(/Not enough|Rating updating/)).toBeNull();
      await view.unmount();
      client.clear();
    });
  },
);
