import { render } from "@testing-library/react-native";

import BusinessCard from "../BusinessCard";
import type {
  ExploreBusiness,
  RecommendationReason,
} from "../../../types/exploreBusiness.types";

jest.mock("expo-router", () => ({
  useNavigation: () => ({
    isFocused: () => true,
  }),
}));

const business: ExploreBusiness = {
  id: 12,
  business_name: "Reason Test Business",
  cover_photo_url: null,
  is_pocketed: false,
  cluster: {
    id: 2,
    name: "Culinary",
    icon: "utensils",
  },
  category: {
    id: 8,
    name: "Cafe",
  },
  specialty_tags: [],
  location: {
    address: "Cebu",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.31,
    longitude: 123.89,
  },
};

const reason: RecommendationReason = {
  type: "specialty_tag",
  id: 14,
  label: "Local Coffee",
};

async function renderCard(
  variant: "default" | "featured" | "compact",
  recommendationReason: RecommendationReason | null,
) {
  return render(
    <BusinessCard
      business={business}
      distance={null}
      distanceAccuracy={null}
      onPress={jest.fn()}
      variant={variant}
      recommendationReason={recommendationReason}
    />,
  );
}

describe("BusinessCard recommendation reason", () => {
  it("renders a one-line reason on the compact variant", async () => {
    const screen = await renderCard(
      "compact",
      reason,
    );
    const reasonText = screen.getByText(
      "Interested in Local Coffee",
    );

    expect(reasonText.props.numberOfLines).toBe(1);
    await screen.unmount();
  });

  it("renders nothing when the compact reason is null", async () => {
    const screen = await renderCard(
      "compact",
      null,
    );

    expect(screen.queryByText(/Interested in/)).toBeNull();
    await screen.unmount();
  });

  it.each([
    "default",
    "featured",
  ] as const)("does not render the reason on the %s variant", async (variant) => {
    const screen = await renderCard(
      variant,
      reason,
    );

    expect(screen.queryByText(/Interested in/)).toBeNull();
    await screen.unmount();
  });
});
