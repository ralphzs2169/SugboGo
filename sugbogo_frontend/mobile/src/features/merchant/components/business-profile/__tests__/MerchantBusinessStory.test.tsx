import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import type { MerchantBusinessProfileResponse } from "../../../types/merchantBusinessProfile.types";
import MerchantBusinessStory from "../MerchantBusinessStory";

const business = {
  status: "active",
  description: "Local Cebu food",
  specialty_tags: [
    { id: 1, name: "Adventure", color: "blue", icon: "tag" },
    { id: 2, name: "Aesthetic", color: "green", icon: "chef_hat" },
    { id: 3, name: "Pet Friendly", color: "yellow", icon: "coffee" },
  ],
} as MerchantBusinessProfileResponse;

describe("MerchantBusinessStory", () => {
  it("keeps specialties and the short introduction together", async () => {
    const onEditInformation = jest.fn();
    const screen = await render(
      <MerchantBusinessStory
        business={business}
        onEditInformation={onEditInformation}
      />,
    );

    expect(screen.getByText("Adventure")).toBeTruthy();
    expect(screen.getByText("Aesthetic")).toBeTruthy();
    expect(screen.getByText("Pet Friendly")).toBeTruthy();
    const specialtyGlyph = String.fromCodePoint(
      Number(MaterialCommunityIcons.glyphMap["tag-outline"]),
    );
    expect(screen.getByText(specialtyGlyph)).toBeTruthy();
    expect(screen.getByText("Local Cebu food")).toBeTruthy();
    expect(screen.queryByText("Classification")).toBeNull();
    await fireEvent.press(screen.getByLabelText("Edit business information"));
    expect(onEditInformation).toHaveBeenCalledTimes(1);
  });

  it("shows only approved business content", async () => {
    const screen = await render(<MerchantBusinessStory business={business} />);

    expect(screen.queryByText("Classification pending review")).toBeNull();
    expect(screen.queryByText("Retry request status")).toBeNull();
  });

  it("expands long descriptions and hides direct editing while suspended", async () => {
    const description = "A Cebu business with local food and coffee. ".repeat(
      8,
    );
    const screen = await render(
      <MerchantBusinessStory
        business={{ ...business, description, status: "suspended" }}
        onEditInformation={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("Edit business information")).toBeNull();
    await fireEvent.press(screen.getByText("Read more"));
    expect(screen.getByText(description)).toBeTruthy();
  });
});
