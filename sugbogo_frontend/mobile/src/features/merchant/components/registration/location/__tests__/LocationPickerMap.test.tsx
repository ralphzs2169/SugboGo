import { fireEvent, render } from "@testing-library/react-native";
import { Platform } from "react-native";

import { MAP_STYLE } from "@/features/merchant/constants/registration/map.constants";
import { ANDROID_LIGHT_MAP_STYLE } from "@/shared/constants/androidLightMapStyle";
import LocationPickerMap from "../LocationPickerMap";

jest.mock("expo-router", () => ({
  useIsFocused: () => true,
}));

jest.mock("react-native-maps", () => {
  const { View } = jest.requireActual<typeof import("react-native")>("react-native");

  return {
    __esModule: true,
    default: (props: React.ComponentProps<typeof View>) => (
      <View {...props} testID="location-picker-native-map" />
    ),
    Marker: View,
    PROVIDER_GOOGLE: "google",
  };
});

it.each([
  ["android", ANDROID_LIGHT_MAP_STYLE],
  ["ios", MAP_STYLE],
] as const)("styles the %s location picker and forwards map taps", async (os, style) => {
  const platform = jest.replaceProperty(Platform, "OS", os);
  const onLocationSelect = jest.fn();

  try {
    const screen = await render(
      <LocationPickerMap
        latitude={null}
        longitude={null}
        onLocationSelect={onLocationSelect}
        fullScreen
      />,
    );
    const map = screen.getByTestId("location-picker-native-map");

    expect(map.props.customMapStyle).toBe(style);
    expect(map.props).not.toHaveProperty("googleMapId");
    await fireEvent(map, "press", {
      nativeEvent: {
        coordinate: { latitude: 10.3157, longitude: 123.8854 },
      },
    });
    expect(onLocationSelect).toHaveBeenCalledWith(10.3157, 123.8854);
  } finally {
    platform.restore();
  }
});
