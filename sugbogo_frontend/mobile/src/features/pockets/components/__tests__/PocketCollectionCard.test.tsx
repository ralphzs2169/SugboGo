import { fireEvent, render } from "@testing-library/react-native";

import type { PocketCollection } from "../../types/pockets.types";
import PocketCollectionCard from "../PocketCollectionCard";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));

const collection = {
  id: 1,
  name: "Favorites",
  is_default: true,
  business_count: 3,
  created_at: "2026-10-19T02:00:00Z",
  updated_at: "2026-10-19T02:00:00Z",
} satisfies PocketCollection;

describe("PocketCollectionCard", () => {
  it.each([
    { name: "Favorites", isDefault: true },
    { name: "Weekend food trips", isDefault: false },
  ])(
    "renders $name with the appropriate default status",
    async ({ name, isDefault }) => {
      const screen = await render(
        <PocketCollectionCard
          collection={{ ...collection, name, is_default: isDefault }}
        />,
      );

      expect(screen.getByText(name)).toBeTruthy();
      if (isDefault) {
        expect(screen.getByText("Default")).toBeTruthy();
      } else {
        expect(screen.queryByText("Default")).toBeNull();
      }
    },
  );

  it.each([
    { count: 0, label: "0 businesses" },
    { count: 1, label: "1 business" },
    { count: 2, label: "2 businesses" },
  ])("shows $label without hiding the collection", async ({ count, label }) => {
    const screen = await render(
      <PocketCollectionCard
        collection={{ ...collection, business_count: count }}
      />,
    );

    expect(screen.getByText(collection.name)).toBeTruthy();
    expect(screen.getByText(label)).toBeTruthy();
  });

  it.each([
    "Weekend food trips and coffee stops around Cebu with family and friends",
    "Coffee".repeat(16),
  ])("preserves the complete long name: %s", async (name) => {
    const screen = await render(
      <PocketCollectionCard collection={{ ...collection, name }} />,
    );

    expect(screen.getByText(name)).toBeTruthy();
    expect(screen.getByText("3 businesses")).toBeTruthy();
    expect(screen.getByText("Default")).toBeTruthy();
  });

  it("presents metadata without interactive controls", async () => {
    const screen = await render(
      <PocketCollectionCard collection={collection} />,
    );

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });
  it("keeps collection navigation separate from the custom management action", async () => {
    const open = jest.fn();
    const manage = jest.fn();
    const screen = await render(
      <PocketCollectionCard
        collection={{ ...collection, name: "Coffee", is_default: false }}
        onPress={open}
        onManage={manage}
      />,
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Manage Coffee Pocket" }),
    );
    expect(manage).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    await fireEvent.press(
      screen.getByRole("button", { name: "Open Coffee Pocket" }),
    );
    expect(open).toHaveBeenCalledTimes(1);
  });
  it("never offers management for Favorites even when a callback is supplied", async () => {
    const screen = await render(
      <PocketCollectionCard collection={collection} onManage={jest.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /manage/i })).toBeNull();
  });
});
