import { render } from "@testing-library/react-native";
import { onlineManager } from "@tanstack/react-query";
import colors from "tailwindcss/colors";

import { businessRatingFixture } from "../../../__tests__/review.fixtures";
import BusinessProfileQuickInfo from "../BusinessProfileQuickInfo";
import BusinessSentimentRating from "../BusinessSentimentRating";
import ExploreBusinessHero from "../ExploreBusinessHero";

jest.mock("@expo/vector-icons", () => {
  const { View } = jest.requireActual("react-native");
  return {
    MaterialCommunityIcons: function MockIcon(props: object) {
      return <View testID="rating-surface-icon" {...props} />;
    },
  };
});

jest.mock("../BusinessPocketButton", () => () => null);
jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").View,
}));

const stats = {
  businessId: 21,
  reviewCount: 28,
  statusLabel: "Open",
  statusDetail: "6 PM",
  distance: "1.2 km",
  isOpenNow: true,
};

beforeEach(() => onlineManager.setOnline(true));
afterEach(() => onlineManager.setOnline(true));

it("places the rating beside the identity and keeps metadata free of duplicate review counts", async () => {
  const view = await render(
    <ExploreBusinessHero
      business={{
        id: 21,
        business_name: "A long local cafe and artisan bakehouse name",
        cluster: { id: 1, name: "Food", icon: "store" },
        category: { id: 1, name: "Cafe" },
        display_cover_photo_url: null,
        sentiment_rating: businessRatingFixture(),
      }}
      isOwnBusiness={false}
      onShare={jest.fn()}
      onGoBack={jest.fn()}
    >
      <BusinessProfileQuickInfo {...stats} rating={businessRatingFixture()} />
    </ExploreBusinessHero>,
  );
  expect(view.getByText("3.6")).toBeTruthy();
  expect(view.queryByText("rating")).toBeNull();
  expect(
    view.getByText("A long local cafe and artisan bakehouse name"),
  ).toBeTruthy();
  expect(view.getByLabelText("Business rating 3.6 out of 5")).toBeTruthy();
  expect(view.getByText("Open")).toBeTruthy();
  expect(view.getByLabelText("Open. 6 PM")).toBeTruthy();
  expect(view.getByText("1.2 km away")).toBeTruthy();
  expect(
    view.queryByText(/28|scored reviews|AI sentiment|Experimental|\/5/),
  ).toBeNull();
  expect(view.queryByText("7")).toBeNull();
});

it.each([undefined, "insufficient_data", "pending", "unavailable"] as const)(
  "retains published reviews when rating is %s",
  async (state) => {
    const rating = state
      ? businessRatingFixture({ state, contributing_review_count: 4 })
      : undefined;
    const view = await render(
      <ExploreBusinessHero
        business={{
          id: 21,
          business_name: "Local Cafe",
          cluster: { id: 1, name: "Food", icon: "store" },
          category: { id: 1, name: "Cafe" },
          display_cover_photo_url: null,
          sentiment_rating: rating,
        }}
        isOwnBusiness={false}
        onShare={jest.fn()}
        onGoBack={jest.fn()}
      >
        <BusinessProfileQuickInfo {...stats} rating={rating} />
      </ExploreBusinessHero>,
    );
    expect(view.getByText("28 reviews")).toBeTruthy();
    expect(view.queryByText("rating")).toBeNull();
    expect(view.queryByText(/Not enough|Rating unavailable|3.6/)).toBeNull();
    expect(view.queryByLabelText(/Business rating/)).toBeNull();
  },
);

it("does not expose cached ratings on the offline stats surface", async () => {
  onlineManager.setOnline(false);
  const view = await render(
    <BusinessProfileQuickInfo {...stats} rating={businessRatingFixture()} />,
  );
  expect(view.queryByText("3.6")).toBeNull();
  expect(view.getByText("28 reviews")).toBeTruthy();
});

it.each(["stat", "inline", "header"] as const)(
  "keeps %s ratings value-only with a fixed gold star",
  async (variant) => {
    for (const value of [1, 5]) {
      const view = await render(
        <BusinessSentimentRating
          businessId={21}
          rating={businessRatingFixture({ value })}
          variant={variant}
        />,
      );
      expect(view.getByText(value.toFixed(1))).toBeTruthy();
      const star = view.getByTestId("rating-surface-icon", {
        includeHiddenElements: true,
      });
      expect(star.props.name).toBe("star");
      expect(star.props.color).toBe(colors.amber[500]);
      expect(
        view.queryByText(/\(7\)|\/5|AI sentiment|Experimental/),
      ).toBeNull();
      await view.unmount();
    }
  },
);
