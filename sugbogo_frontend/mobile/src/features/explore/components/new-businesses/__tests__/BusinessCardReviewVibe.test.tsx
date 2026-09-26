import { render } from "@testing-library/react-native";

import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import BusinessCard from "../BusinessCard";

jest.mock("expo-router", () => ({
  useNavigation: () => ({
    isFocused: () => true,
  }),
}));

const business = {
  id: 12,
  business_name: "Review Vibe Cafe",
  cover_photo_url: null,
  review_count: 12,
  overall_vibe: "mostly_positive",
  is_pocketed: false,
  cluster: { id: 2, name: "Culinary", icon: "utensils" },
  category: { id: 8, name: "Cafe" },
  specialty_tags: [],
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
} satisfies ExploreBusiness;

async function renderBusiness(overrides: Partial<ExploreBusiness>) {
  return render(
    <BusinessCard
      business={{ ...business, ...overrides }}
      distance={null}
      distanceAccuracy={null}
      onPress={jest.fn()}
    />,
  );
}

describe("BusinessCard review vibe", () => {
  it("shows review count and vibe when available", async () => {
    const screen = await renderBusiness({});
    expect(screen.getByText("12 reviews · Mostly positive")).toBeTruthy();
  });

  it("shows only the review count when vibe is unavailable", async () => {
    const screen = await renderBusiness({
      review_count: 3,
      overall_vibe: null,
    });
    expect(screen.getByText("3 reviews")).toBeTruthy();
  });

  it("shows the no-review state", async () => {
    const screen = await renderBusiness({
      review_count: 0,
      overall_vibe: null,
    });
    expect(screen.getByText("No reviews yet")).toBeTruthy();
  });

  it("keeps review metadata off compact cards", async () => {
    const screen = await render(
      <BusinessCard
        business={business}
        distance={null}
        distanceAccuracy={null}
        onPress={jest.fn()}
        variant="compact"
      />,
    );
    expect(screen.queryByText(/12 reviews/)).toBeNull();
  });
});
