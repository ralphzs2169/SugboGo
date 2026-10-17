import React from "react";
import { render } from "@testing-library/react-native";

import MapMarker from "../MapMarker";

jest.mock("@expo/vector-icons/MaterialCommunityIcons", () => {
  const { View } = jest.requireActual("react-native");
  return function MockIcon(props: object) {
    return <View testID="marker-icon" {...props} />;
  };
});
jest.mock("@/shared/components/Avatar", () => {
  const { View } = jest.requireActual("react-native");
  return function MockAvatar(props: object) {
    return <View testID="marker-avatar" {...props} />;
  };
});

it("uses the gem glyph and accessible identity even when an image is supplied", async () => {
  const screen = await render(
    <MapMarker
      variant="hidden-gem"
      imageUrl="https://example.com/photo.jpg"
      clusterIcon="coffee"
    />,
  );
  expect(screen.getByLabelText("Hidden Gem")).toBeTruthy();
  expect(
    screen.getAllByTestId("marker-icon").map((icon) => icon.props.name),
  ).toContain("diamond-stone");
});

it.each([
  ["utensils", "silverware-fork-knife"],
  ["coffee", "coffee"],
  ["unsupported", "store-outline"],
  [null, "store-outline"],
])("renders the requested business cluster icon %s", async (clusterIcon, icon) => {
  const screen = await render(
    <MapMarker variant="business" clusterIcon={clusterIcon} selected />,
  );
  expect(screen.getByTestId("marker-icon").props.name).toBe(icon);
});

it.each([
  ["business", "store-outline"],
  ["destination", "store-outline"],
  ["google", "map-marker-outline"],
  ["custom", "star-outline"],
  ["pending", "plus"],
  ["boarding", "bus-stop"],
  ["alighting", "exit-run"],
] as const)("preserves the existing %s identity", async (variant, icon) => {
  const screen = await render(<MapMarker variant={variant} />);
  expect(screen.getByTestId("marker-icon").props.name).toBe(icon);
  expect(screen.queryByLabelText("Hidden Gem")).toBeNull();
});

it("preserves explorer avatar markers and origin markers", async () => {
  const screen = await render(
    <MapMarker variant="explorer" avatarKey="avatar-1" />,
  );
  expect(screen.getByTestId("marker-avatar").props.avatarKey).toBe("avatar-1");
  await screen.rerender(<MapMarker variant="origin" />);
  expect(screen.queryByTestId("marker-avatar")).toBeNull();
  expect(screen.queryByLabelText("Hidden Gem")).toBeNull();
});
