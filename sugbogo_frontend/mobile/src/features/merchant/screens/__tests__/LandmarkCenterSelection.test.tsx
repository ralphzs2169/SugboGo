import { act, fireEvent, render } from "@testing-library/react-native";
import Toast from "react-native-toast-message";
import LandmarkPickerScreen from "../LandmarkPickerScreen";
let mockMap: any;
jest.mock("react-native-maps", () => {
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: any) => {
      mockMap = props;
      return <View>{props.children}</View>;
    },
    Marker: View,
    Circle: View,
  };
});
jest.mock("@/shared/components/MapMarker", () => () => null);
jest.mock("@/shared/components/MapMarkerCallout", () => () => null);
jest.mock("expo-router", () => ({
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
const business = { latitude: 10.3, longitude: 123.9 } as any;
const selected = { latitude: 10.3001, longitude: 123.9001 };
test.each(["map center", "map tap"])(
  "%s produces the same normalized custom landmark",
  async (method) => {
    const confirm = jest.fn();
    const screen = await render(
      <LandmarkPickerScreen
        businessLocation={business}
        selectedLandmarks={[]}
        onConfirm={confirm}
        onClose={jest.fn()}
      />,
    );
    if (method === "map center") {
      await act(() => mockMap.onRegionChangeComplete(selected));
      await fireEvent.press(
        screen.getByRole("button", { name: "Use map center for landmark" }),
      );
    } else
      await act(() =>
        mockMap.onPress({ nativeEvent: { coordinate: selected } }),
      );
    await fireEvent.changeText(
      screen.getByLabelText("Landmark name"),
      "  Main   entrance  ",
    );
    await fireEvent.press(screen.getByRole("button", { name: "Add Landmark" }));
    expect(confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        ...selected,
        name: "Main entrance",
        address: "",
        source: "custom",
      }),
    );
  },
);
test("map center uses existing radius and duplicate-name validation", async () => {
  const confirm = jest.fn();
  const screen = await render(
    <LandmarkPickerScreen
      businessLocation={business}
      selectedLandmarks={[
        {
          ...selected,
          id: "old",
          name: "Main entrance",
          source: "custom",
          address: "",
        },
      ]}
      onConfirm={confirm}
      onClose={jest.fn()}
    />,
  );
  await act(() =>
    mockMap.onRegionChangeComplete({ latitude: 11, longitude: 124 }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Use map center for landmark" }),
  );
  expect(Toast.show).toHaveBeenCalledWith(
    expect.objectContaining({ text1: "Outside landmark area" }),
  );
  expect(screen.queryByLabelText("Landmark name")).toBeNull();
  await act(() => mockMap.onRegionChangeComplete(selected));
  await fireEvent.press(
    screen.getByRole("button", { name: "Use map center for landmark" }),
  );
  await fireEvent.changeText(
    screen.getByLabelText("Landmark name"),
    "Main entrance",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Add Landmark" }));
  expect(confirm).not.toHaveBeenCalled();
  expect(
    screen.getByText("A landmark with this name already exists."),
  ).toBeTruthy();
});
