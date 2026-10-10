import React from "react";
import { cleanup, render } from "@testing-library/react-native";

import ClassificationChangeReviewSections from "../ClassificationChangeReviewSections";

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: ({ name }: { name: string }) => {
    const { Text } = jest.requireActual("react-native");
    return <Text>{name}</Text>;
  },
}));

const current = {
  category: { id: 1, name: "Restaurants" },
  cluster: { name: "Culinary", icon: "utensils" },
};

const proposed = {
  category: { id: 2, name: "Creative Arts" },
  cluster: { name: "Culture", icon: "landmark" },
};

const currentTags = [
  { id: 1, name: "Traditional" },
  { id: 2, name: "Spicy" },
];

const proposedTags = [
  { id: 2, name: "Spicy" },
  { id: 3, name: "Handmade" },
];

describe("ClassificationChangeReviewSections", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("renders only the category comparison card for a category-only change", async () => {
    const screen = await render(
      <ClassificationChangeReviewSections
        current={current}
        proposed={proposed}
        currentTags={currentTags}
        proposedTags={currentTags}
      />,
    );

    expect(screen.getByText("Category change")).toBeTruthy();
    expect(screen.getByText("Currently live")).toBeTruthy();
    expect(screen.getByText("Proposed")).toBeTruthy();
    expect(screen.queryByText("Specialty changes")).toBeNull();
  });

  it("renders only grouped specialty changes in submission review", async () => {
    const screen = await render(
      <ClassificationChangeReviewSections
        current={current}
        proposed={current}
        currentTags={currentTags}
        proposedTags={proposedTags}
      />,
    );

    expect(screen.queryByText("Category change")).toBeNull();
    expect(screen.getByText("Specialty changes")).toBeTruthy();
    expect(screen.getByText("To be added (1)")).toBeTruthy();
    expect(screen.getByText("To be removed (1)")).toBeTruthy();
    expect(screen.getByText("plus-circle-outline")).toBeTruthy();
    expect(screen.getByText("minus-circle-outline")).toBeTruthy();
    expect(screen.getByText("Handmade")).toBeTruthy();
    expect(screen.getByText("Traditional")).toBeTruthy();
  });

  it.each([
    ["pending", "Requested to add", "Requested to remove"],
    ["rejected", "Requested to add", "Requested to remove"],
    ["withdrawn", "Requested to add", "Requested to remove"],
    ["approved", "Added", "Removed"],
  ] as const)(
    "renders combined %s changes in the same cards",
    async (status, added, removed) => {
      const screen = await render(
        <ClassificationChangeReviewSections
          current={current}
          proposed={proposed}
          currentTags={currentTags}
          proposedTags={proposedTags}
          status={status}
        />,
      );

      expect(screen.getByText("Category change")).toBeTruthy();
      expect(screen.getByText("Specialty changes")).toBeTruthy();
      expect(screen.getByText(`${added} (1)`)).toBeTruthy();
      expect(screen.getByText(`${removed} (1)`)).toBeTruthy();
      expect(screen.getByText("At submission")).toBeTruthy();
    },
  );
});
