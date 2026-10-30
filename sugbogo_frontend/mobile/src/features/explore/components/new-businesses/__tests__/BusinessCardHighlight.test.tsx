import { render } from "@testing-library/react-native";

import type { ExploreBusiness } from "../../../types/exploreBusiness.types";
import BusinessCard from "../BusinessCard";

jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

const business: ExploreBusiness = {
  id: 42,
  business_name: "Coffee Corner",
  cover_photo_url: null,
  display_cover_photo_url: null,
  review_count: 0,
  overall_vibe: null,
  is_pocketed: false,
  cluster: { id: 1, name: "Coffee District", icon: "coffee" },
  category: { id: 2, name: "Coffee Shops" },
  specialty_tags: [
    {
      id: 3,
      name: "Brewed COFFEE",
      color: "blue",
      icon: "coffee",
      vouch_count: 0,
      is_vouched: false,
    },
  ],
  location: {
    address: "",
    city: "Cebu",
    province: "Cebu",
    latitude: 10,
    longitude: 123,
  },
};

it("highlights only the existing visible business, category, and specialty text", async () => {
  const screen = await render(
    <BusinessCard
      business={business}
      distance={null}
      distanceAccuracy={null}
      onPress={jest.fn()}
      variant="compact"
      highlightQuery="coffee"
    />,
  );

  expect(
    screen
      .getAllByTestId("literal-text-highlight")
      .map((match) => match.props.children),
  ).toEqual(["Coffee", "Coffee", "COFFEE"]);
  expect(screen.queryByText("Coffee District")).toBeNull();
  expect(
    screen.getByRole("button", { name: /Open Coffee Corner business profile/ }),
  ).toBeTruthy();
});

it("renders fuzzy-only names normally and clears old highlight segments", async () => {
  const props = {
    business,
    distance: null,
    distanceAccuracy: null,
    onPress: jest.fn(),
    variant: "compact" as const,
  };
  const screen = await render(
    <BusinessCard {...props} highlightQuery="coffee" />,
  );
  await screen.rerender(<BusinessCard {...props} highlightQuery="advventre" />);
  expect(screen.queryAllByTestId("literal-text-highlight")).toHaveLength(0);
  expect(screen.getByText("Coffee Corner")).toBeTruthy();
});
