import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import MSMEPreviewCard from "../MSMEPreviewCard";
import type { MapDiscoveryBusiness } from "../../types/mapDiscovery.types";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

const business: MapDiscoveryBusiness = {
  id: 42,
  business_name: "Cebu Coffee House",
  display_cover_photo_url: "https://example.com/storefront.jpg",
  cover_photo_url: "https://example.com/cover.jpg",
  category: { id: 3, name: "Cafe" },
  cluster: { id: 1, name: "Culinary", icon: "coffee" },
  location: {
    address: "Real Street",
    city: "Cebu City",
    province: "Cebu",
    latitude: 10.35,
    longitude: 123.9,
  },
  specialty_tags: [
    { id: 4, name: "Local Coffee", color: "blue", icon: "coffee" },
    { id: 5, name: "Local Pastries", color: "yellow", icon: "cake" },
    { id: 6, name: "Family Friendly", color: "green", icon: null },
  ],
  is_hidden_gem: true,
};

it("shows API identity, concise specialty chips, and working close/profile actions", async () => {
  const onClose = jest.fn();
  const onViewBusiness = jest.fn();
  const screen = await render(
    <MSMEPreviewCard
      business={business}
      onClose={onClose}
      onViewBusiness={onViewBusiness}
    />,
  );
  expect(screen.getByText(business.business_name)).toBeTruthy();
  expect(screen.getByText("Cafe")).toBeTruthy();
  expect(screen.getByText("Real Street, Cebu City, Cebu")).toBeTruthy();
  expect(screen.getByText("Local Coffee")).toBeTruthy();
  expect(screen.getByText("Local Pastries")).toBeTruthy();
  expect(screen.getByText("+1 more")).toBeTruthy();
  expect(screen.queryByText("Family Friendly")).toBeNull();
  expect(screen.getByText("Hidden Gem")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Close business preview" }),
  );
  expect(onClose).toHaveBeenCalledTimes(1);
  await fireEvent.press(
    screen.getByRole("button", {
      name: "View Cebu Coffee House business profile",
    }),
  );
  expect(onViewBusiness).toHaveBeenCalledTimes(1);
});

it("falls back from a failed display photo to cover photo, then to the shared category icon", async () => {
  const screen = await render(
    <MSMEPreviewCard
      business={business}
      onClose={jest.fn()}
      onViewBusiness={jest.fn()}
    />,
  );
  const image = () => screen.getByLabelText("Cebu Coffee House cover photo");
  expect(image().props.source[0]).toEqual({
    uri: business.display_cover_photo_url,
  });
  await fireEvent(image(), "error", { nativeEvent: { error: "Photo failed" } });
  expect(image().props.source[0]).toEqual({ uri: business.cover_photo_url });
  await fireEvent(image(), "error", { nativeEvent: { error: "Photo failed" } });
  expect(screen.getByLabelText("Business photo unavailable")).toBeTruthy();
});

it("handles missing photos, classification, address and tags without inventing details", async () => {
  const incomplete = {
    ...business,
    display_cover_photo_url: null,
    cover_photo_url: null,
    cluster: null,
    category: null,
    location: { ...business.location, address: "", city: "", province: "" },
    specialty_tags: null,
  } as unknown as MapDiscoveryBusiness;
  const screen = await render(
    <MSMEPreviewCard
      business={incomplete}
      onClose={jest.fn()}
      onViewBusiness={jest.fn()}
    />,
  );
  expect(screen.getByLabelText("Business photo unavailable")).toBeTruthy();
  expect(screen.getByText("Address unavailable")).toBeTruthy();
  expect(screen.queryByText("Local Coffee")).toBeNull();
  expect(screen.getByText("View Business")).toBeTruthy();
});

it("uses the cluster classification when category information is missing", async () => {
  const screen = await render(
    <MSMEPreviewCard
      business={{ ...business, category: { id: 3, name: "" } }}
      onClose={jest.fn()}
      onViewBusiness={jest.fn()}
    />,
  );
  expect(screen.getByText("Culinary")).toBeTruthy();
});

it.each([false, undefined])(
  "omits the Hidden Gem label when status is %s",
  async (isHiddenGem) => {
    const screen = await render(
      <MSMEPreviewCard
        business={
          { ...business, is_hidden_gem: isHiddenGem } as MapDiscoveryBusiness
        }
        onClose={jest.fn()}
        onViewBusiness={jest.fn()}
      />,
    );
    expect(screen.queryByText("Hidden Gem")).toBeNull();
  },
);
