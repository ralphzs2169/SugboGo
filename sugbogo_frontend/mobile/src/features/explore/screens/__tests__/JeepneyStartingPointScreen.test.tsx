import {
  fireEvent,
  render,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import useUserLocation from "@/shared/hooks/useUserLocation";

import { reverseGeocodeJourneyOrigin } from "../../api/journeyOrigin.service";
import { useJourneyOriginStore } from "../../stores/journeyOrigin.store";
import JeepneyStartingPointScreen from "../JeepneyStartingPointScreen";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));
jest.mock("@/shared/hooks/useUserLocation");
jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");

  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});
jest.mock("../../api/journeyOrigin.service", () => ({
  reverseGeocodeJourneyOrigin: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));
jest.mock(
  "../../components/getting-there/JourneyOriginPickerMap",
  () =>
    function MockJourneyOriginPickerMap({
      origin,
      onLocationSelect,
    }: {
      origin: { label: string } | null;
      onLocationSelect: (latitude: number, longitude: number) => void;
    }) {
      const { Pressable, Text, View } = jest.requireActual("react-native");

      return (
        <View>
          <Text>{origin?.label ?? "No draft origin"}</Text>
          <Pressable onPress={() => onLocationSelect(10.32, 123.9)}>
            <Text>Choose map point</Text>
          </Pressable>
        </View>
      );
    },
);
jest.mock(
  "../../components/getting-there/JourneyOriginSearchSheet",
  () =>
    function MockJourneyOriginSearchSheet({
      onPlaceSelect,
    }: {
      onPlaceSelect: (
        latitude: number,
        longitude: number,
        label: string,
      ) => void;
    }) {
      const { Pressable, Text } = jest.requireActual("react-native");

      return (
        <Pressable
          onPress={() =>
            onPlaceSelect(10.318, 123.904, "Ayala Center Cebu")
          }
        >
          <Text>Select searched place</Text>
        </Pressable>
      );
    },
);

const refreshLocation = jest.fn();

describe("JeepneyStartingPointScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useJourneyOriginStore.setState({
      businessId: null,
      confirmedOrigin: null,
    });
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "available",
      latitude: 10.3,
      longitude: 123.88,
      isRefreshingLocation: false,
      refreshLocation,
    });
    (reverseGeocodeJourneyOrigin as jest.Mock).mockResolvedValue({
      success: true,
      data: {
        address: {
          formattedAddress: "Fuente Osmeña Circle",
        },
      },
    });
  });

  it("starts from device location and commits only on confirmation", async () => {
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Current location").length).toBeGreaterThan(0);
    });
    expect(useJourneyOriginStore.getState().confirmedOrigin).toBeNull();

    fireEvent.press(screen.getByText("Confirm starting point"));

    expect(useJourneyOriginStore.getState().confirmedOrigin).toEqual({
      type: "current",
      latitude: 10.3,
      longitude: 123.88,
      label: "Current location",
    });
    expect(router.back).toHaveBeenCalled();
  });

  it("updates the draft from place search before confirming it", async () => {
    const user = userEvent.setup();
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    await user.press(screen.getByText("Select searched place"));
    expect(screen.getAllByText("Ayala Center Cebu").length).toBeGreaterThan(0);

    fireEvent.press(screen.getByText("Confirm starting point"));

    expect(useJourneyOriginStore.getState().confirmedOrigin).toEqual({
      type: "selected",
      latitude: 10.318,
      longitude: 123.904,
      label: "Ayala Center Cebu",
    });
  });

  it("discards map experiments when Back is pressed", async () => {
    const user = userEvent.setup();
    const confirmedOrigin = {
      type: "selected" as const,
      latitude: 10.31,
      longitude: 123.89,
      label: "Confirmed origin",
    };
    useJourneyOriginStore.setState({
      businessId: 21,
      confirmedOrigin,
    });
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    await user.press(screen.getByText("Choose map point"));
    await waitFor(() => {
      expect(screen.getAllByText("Fuente Osmeña Circle").length).toBeGreaterThan(
        0,
      );
    });
    fireEvent.press(
      screen.getByLabelText("Go back without changing starting point"),
    );

    expect(useJourneyOriginStore.getState().confirmedOrigin).toEqual(
      confirmedOrigin,
    );
    expect(router.back).toHaveBeenCalled();
  });

  it("keeps map coordinates usable when reverse geocoding fails", async () => {
    const user = userEvent.setup();
    (reverseGeocodeJourneyOrigin as jest.Mock).mockResolvedValue({
      success: false,
      code: "LOCATION_SERVICE_UNAVAILABLE",
      message: "Unable to connect to the location service.",
    });
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    await user.press(screen.getByText("Choose map point"));

    await waitFor(() => {
      expect(
        screen.getAllByText("Selected map location").length,
      ).toBeGreaterThan(0);
    });
    expect(Toast.show).toHaveBeenCalledWith({
      type: "error",
      text1: "Unable to get this address",
      text2: "Your selected map location is still available.",
    });

    fireEvent.press(screen.getByText("Confirm starting point"));

    expect(useJourneyOriginStore.getState().confirmedOrigin).toEqual({
      type: "selected",
      latitude: 10.32,
      longitude: 123.9,
      label: "Selected map location",
    });
  });

  it("can switch a confirmed manual origin back to current location", async () => {
    const user = userEvent.setup();
    useJourneyOriginStore.setState({
      businessId: 21,
      confirmedOrigin: {
        type: "selected",
        latitude: 10.31,
        longitude: 123.89,
        label: "Ayala Center Cebu",
      },
    });
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    expect(screen.getAllByText("Ayala Center Cebu").length).toBeGreaterThan(0);
    await user.press(screen.getByText("Use current location"));
    await user.press(screen.getByText("Confirm starting point"));

    expect(useJourneyOriginStore.getState().confirmedOrigin).toEqual({
      type: "current",
      latitude: 10.3,
      longitude: 123.88,
      label: "Current location",
    });
  });

  it("allows place selection when device location is unavailable", async () => {
    const user = userEvent.setup();
    (useUserLocation as jest.Mock).mockReturnValue({
      status: "denied",
      latitude: null,
      longitude: null,
      isRefreshingLocation: false,
      refreshLocation,
    });
    const screen = await render(
      <JeepneyStartingPointScreen businessId={21} />,
    );

    expect(
      screen.getAllByText("Tap the map or search for a place.").length,
    ).toBeGreaterThan(0);
    await user.press(screen.getByText("Select searched place"));
    fireEvent.press(screen.getByText("Confirm starting point"));

    expect(useJourneyOriginStore.getState().confirmedOrigin?.label).toBe(
      "Ayala Center Cebu",
    );
  });
});
