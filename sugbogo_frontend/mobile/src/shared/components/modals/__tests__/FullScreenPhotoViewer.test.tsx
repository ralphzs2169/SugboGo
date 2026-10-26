import { fireEvent, render } from "@testing-library/react-native";

import FullScreenPhotoViewer from "../FullScreenPhotoViewer";

jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("expo-image", () => ({
  Image: ({ source, ...props }: { source: { uri: string } }) => {
    const { View } = jest.requireActual("react-native");

    return <View {...props} testID={source.uri} />;
  },
}));
jest.mock("react-native-gesture-handler", () => {
  const { View } = jest.requireActual("react-native");
  const gesture = () => ({
    onUpdate() {
      return this;
    },
    onEnd() {
      return this;
    },
    enabled() {
      return this;
    },
    numberOfTaps() {
      return this;
    },
  });

  return {
    GestureHandlerRootView: View,
    GestureDetector: ({ children }: { children: React.ReactNode }) => children,
    Gesture: {
      Pinch: gesture,
      Pan: gesture,
      Tap: gesture,
      Simultaneous: jest.fn(),
    },
  };
});
jest.mock("react-native-reanimated", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");

  return {
    __esModule: true,
    default: { View },
    useSharedValue: (value: number) =>
      React.useRef({
        value,
        get() {
          return this.value;
        },
        set(next: number) {
          this.value = next;
        },
      }).current,
    useAnimatedStyle: () => ({}),
    withSpring: (value: number) => value,
    withTiming: (value: number) => value,
  };
});
jest.mock("react-native-worklets", () => ({ scheduleOnRN: jest.fn() }));

describe("FullScreenPhotoViewer accessibility and recovery", () => {
  it("uses supplied photo context and a positional fallback for other consumers", async () => {
    const screen = await render(
      <FullScreenPhotoViewer
        visible
        photos={[
          { uri: "first.jpg", accessibilityLabel: "Review photo 1 of 2" },
          { uri: "second.jpg" },
        ]}
        onClose={jest.fn()}
      />,
    );

    expect(
      screen.getByRole("image", { name: "Review photo 1 of 2" }),
    ).toBeTruthy();
    expect(screen.getByRole("image", { name: "Photo 2 of 2" })).toBeTruthy();
  });

  it("keeps retry, other photos and Close available after a labelled image fails", async () => {
    const onClose = jest.fn();
    const screen = await render(
      <FullScreenPhotoViewer
        visible
        photos={[
          {
            uri: "first.jpg",
            accessibilityLabel: "Merchant response photo 1 of 2",
          },
          {
            uri: "second.jpg",
            accessibilityLabel: "Merchant response photo 2 of 2",
          },
        ]}
        onClose={onClose}
      />,
    );

    await fireEvent(screen.getByTestId("first.jpg"), "error", {
      error: "Unavailable",
    });
    expect(
      screen.getByLabelText(
        "Merchant response photo 1 of 2. Couldn't load photo.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByRole("image", { name: "Merchant response photo 2 of 2" }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(
      screen.getByRole("image", { name: "Merchant response photo 1 of 2" }),
    ).toBeTruthy();
    await fireEvent.press(
      screen.getByRole("button", { name: "Close photo viewer" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
