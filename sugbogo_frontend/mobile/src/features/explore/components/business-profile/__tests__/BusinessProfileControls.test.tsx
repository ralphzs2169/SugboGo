import { fireEvent, render } from "@testing-library/react-native";
import { Animated } from "react-native";

import BusinessAboutContent from "../BusinessAboutContent";
import BusinessPhotosSection from "../BusinessPhotosSection";
import BusinessProfileStickyHeader from "../BusinessProfileStickyHeader";

jest.mock(
  "@/shared/components/AppText",
  () => jest.requireActual("react-native").Text,
);
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("expo-image", () => ({
  Image: jest.requireActual("react-native").View,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24 }),
}));
jest.mock("../BusinessPocketButton", () => () => null);

it("announces description expansion and retains the complete description", async () => {
  const description = "Local coffee and pastries. ".repeat(15);
  const screen = await render(
    <BusinessAboutContent description={description} />,
  );
  const more = screen.getByRole("button", {
    name: "Read more about this place",
  });
  expect(more.props.accessibilityState.expanded).toBe(false);
  await fireEvent.press(more);
  expect(screen.getByText(description)).toBeTruthy();
  const less = screen.getByRole("button", {
    name: "Show less about this place",
  });
  expect(less.props.accessibilityState.expanded).toBe(true);
  await fireEvent.press(less);
  expect(
    screen.getByRole("button", { name: "Read more about this place" }),
  ).toBeTruthy();
});

it("gives gallery actions distinct labels and opens the selected photo", async () => {
  const photos = Array.from({ length: 5 }, (_, index) => ({
    id: index + 1,
    photo_url: `https://example.com/${index}.jpg`,
    category: "storefront",
  }));
  const onPhotoPress = jest.fn();
  const screen = await render(
    <BusinessPhotosSection photos={photos} onPhotoPress={onPhotoPress} />,
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "View photo 1 of 5: storefront" }),
  );
  const last = screen.getByRole("button", {
    name: "View photo 3 of 5: storefront",
  });
  expect(last.props.accessibilityHint).toContain("2 additional photos");
  await fireEvent.press(last);
  expect(onPhotoPress.mock.calls).toEqual([[0], [2]]);
});

it("excludes hidden sticky controls from touch and accessibility, then restores them without remounting", async () => {
  const props = {
    businessId: 21,
    isPocketed: false,
    businessName: "Cafe",
    coverPhotoUrl: null,
    clusterIconName: "store" as const,
    clusterName: "Food",
    categoryName: "Cafe",
    isOwnBusiness: false,
    navOpacity: new Animated.Value(0),
    identityOpacity: new Animated.Value(0),
    translateY: new Animated.Value(-20),
    onShare: jest.fn(),
    onGoBack: jest.fn(),
    navigationVisible: false,
    identityVisible: false,
  };
  const screen = await render(<BusinessProfileStickyHeader {...props} />);
  const navigation = screen.getByTestId("business-profile-sticky-navigation", {
    includeHiddenElements: true,
  });
  expect(navigation.props.pointerEvents).toBe("none");
  expect(screen.queryByRole("button", { name: "Share Cafe" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Go back" })).toBeNull();
  expect(screen.queryByText("Cafe")).toBeNull();
  await screen.rerender(
    <BusinessProfileStickyHeader
      {...props}
      navigationVisible
      identityVisible
    />,
  );
  expect(screen.getByTestId("business-profile-sticky-navigation")).toBe(
    navigation,
  );
  expect(navigation.props.pointerEvents).toBe("auto");
  await fireEvent.press(screen.getByRole("button", { name: "Share Cafe" }));
  expect(props.onShare).toHaveBeenCalledTimes(1);
  await screen.rerender(<BusinessProfileStickyHeader {...props} />);
  expect(screen.queryByRole("button", { name: "Share Cafe" })).toBeNull();
});
