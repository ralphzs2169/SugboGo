import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render } from "@testing-library/react-native";

import { reverseGeocode } from "@/shared/api/googlePlaces.service";
import LocationPickerMap from "../../components/registration/location/LocationPickerMap";
import ConfirmLocationSheet from "../../components/registration/location/ConfirmLocationSheet";
import BusinessLocationSearchSheet from "../../components/registration/location/BusinessLocationSearchSheet";
import LocationPickerHeader from "../../components/registration/location/LocationPickerHeader";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import LocationPickerScreen from "../LocationPickerScreen";
import { toPickerLocation } from "../../utils/locationChange.utils";
import { useLocationChangeDraftStore } from "../../stores/locationChangeDraftStore";
import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import type { BusinessLocation } from "@/shared/types/BusinessLocation.types";

jest.mock("@/shared/api/googlePlaces.service", () => ({
  reverseGeocode: jest.fn(),
}));
jest.mock("../../components/registration/location/LocationPickerMap", () => ({
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock(
  "../../components/registration/location/ConfirmLocationSheet",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
);
jest.mock(
  "../../components/registration/location/LocationPickerHeader",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
);
jest.mock(
  "../../components/registration/location/BusinessLocationSearchSheet",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
);
jest.mock(
  "../../components/registration/location/BottomSelectionInfoSheet",
  () => ({
    __esModule: true,
    default: jest.fn(() => null),
  }),
);
jest.mock("@/shared/utils/presentBottomSheet.utils", () => ({
  presentBottomSheet: jest.fn(),
}));

describe("LocationPickerScreen reverse-geocode ordering", () => {
  beforeEach(() => jest.clearAllMocks());

  it("opens registration search from the header and disables map interaction only while confirming", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const screen = await render(
      <LocationPickerScreen
        initialLocation={null}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        isConfirming={false}
      />,
      { wrapper: Wrapper },
    );
    const header = LocationPickerHeader as jest.Mock;
    const map = LocationPickerMap as jest.Mock;

    await act(async () => header.mock.lastCall[0].onSearch());
    expect(presentBottomSheet).toHaveBeenCalledTimes(1);
    expect(map.mock.lastCall[0].interactionEnabled).toBe(true);

    await screen.rerender(
      <LocationPickerScreen
        initialLocation={null}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        isConfirming
      />,
    );
    expect(map.mock.lastCall[0].interactionEnabled).toBe(false);
    expect(map.mock.lastCall[0].onLocationSelect).toBeUndefined();
    screen.unmount();
    client.clear();
  });

  it("does not allow an older map response to replace a newer selection", async () => {
    let resolveFirst: (value: unknown) => void = () => undefined;
    let resolveSecond: (value: unknown) => void = () => undefined;
    (reverseGeocode as jest.Mock)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecond = resolve;
        }),
      );

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }

    const screen = await render(
      <LocationPickerScreen
        initialLocation={null}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        isConfirming={false}
      />,
      { wrapper: Wrapper },
    );
    const map = LocationPickerMap as jest.Mock;
    const selectOnMap = map.mock.lastCall[0].onLocationSelect;

    await act(async () => {
      void selectOnMap(10.31, 123.88);
      void selectOnMap(10.32, 123.89);
      await Promise.resolve();
    });

    resolveSecond({
      success: true,
      message: "New address.",
      data: {
        address: {
          formattedAddress: "New address",
          province: "Cebu",
          city: "Cebu City",
          barangay: "Lahug",
          streetAddress: "New street",
        },
        is_within_service_area: true,
      },
    });
    await act(async () => {
      await Promise.resolve();
    });

    resolveFirst({
      success: true,
      message: "Old address.",
      data: {
        address: {
          formattedAddress: "Old address",
          province: "Cebu",
          city: "Cebu City",
          barangay: "Lahug",
          streetAddress: "Old street",
        },
        is_within_service_area: true,
      },
    });
    await act(async () => {
      await Promise.resolve();
    });

    const confirmation = ConfirmLocationSheet as jest.Mock;
    expect(confirmation.mock.lastCall[0].address).toBe("New address");
    expect(map.mock.lastCall[0].latitude).toBe(10.32);
    expect(map.mock.lastCall[0].longitude).toBe(123.89);

    screen.unmount();
    client.clear();
  });

  it("keeps a selected place when an older map request finishes later", async () => {
    let resolveMap: (value: unknown) => void = () => undefined;
    (reverseGeocode as jest.Mock).mockReturnValue(
      new Promise((resolve) => {
        resolveMap = resolve;
      }),
    );
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const screen = await render(
      <LocationPickerScreen
        initialLocation={null}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        isConfirming={false}
      />,
      { wrapper: Wrapper },
    );
    const map = LocationPickerMap as jest.Mock;
    const searchSheet = BusinessLocationSearchSheet as jest.Mock;
    const selectOnMap = map.mock.lastCall[0].onLocationSelect;

    await act(async () => {
      void selectOnMap(10.31, 123.88);
      await Promise.resolve();
    });
    await act(async () => {
      searchSheet.mock.lastCall[0].onPlaceSelect({
        latitude: 10.32,
        longitude: 123.89,
        formattedAddress: "Selected place",
        province: "Cebu",
        city: "Cebu City",
        barangay: "Lahug",
        streetAddress: "Place street",
        isWithinServiceArea: true,
      });
    });
    resolveMap({
      success: false,
      message: "Old map request failed.",
      code: "NETWORK_ERROR",
    });
    await act(async () => {
      await Promise.resolve();
    });

    const confirmation = ConfirmLocationSheet as jest.Mock;
    expect(confirmation.mock.lastCall[0].address).toBe("Selected place");
    expect(confirmation.mock.lastCall[0].isResolvingAddress).toBe(false);
    expect(map.mock.lastCall[0].latitude).toBe(10.32);
    expect(map.mock.lastCall[0].longitude).toBe(123.89);

    screen.unmount();
    client.clear();
  });

  it("uses Business 1's persisted coordinate identically in Registration and Location Change", async () => {
    // Business 1 / LOCT_ID 2 in the local database: Point(x=longitude, y=latitude).
    const latitude = 10.299255281007682;
    const longitude = 123.90291843563318;
    const registrationLocation: BusinessLocation = {
      latitude,
      longitude,
      formattedAddress: "Existing flat address",
      city: "Cebu City",
      province: "Cebu",
      barangay: "",
      streetAddress: "",
      isWithinServiceArea: true,
    };
    const profileLocation = {
      latitude,
      longitude,
      address: "Existing flat address",
      city: "Cebu City",
      province: "Cebu",
      postal_code: null,
      landmarks: [],
    };
    useLocationChangeDraftStore.getState().reset();
    useLocationChangeDraftStore.getState().initialize({
      id: 1,
      location: profileLocation,
    } as unknown as MerchantBusinessProfileResponse);
    const draft = useLocationChangeDraftStore.getState().location!;
    expect(draft).toMatchObject({ latitude, longitude });
    const locationChangeLocation = toPickerLocation(draft);
    expect(locationChangeLocation).toMatchObject({ latitude, longitude });
    (reverseGeocode as jest.Mock).mockResolvedValue({
      success: true,
      message: "Location resolved successfully.",
      data: {
        address: {
          formattedAddress: "Existing flat address",
          city: "Cebu City",
          province: "Cebu",
          barangay: "",
          streetAddress: "",
        },
        is_within_service_area: true,
      },
    });

    for (const initialLocation of [
      registrationLocation,
      locationChangeLocation,
    ]) {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: Infinity } },
      });
      function Wrapper({ children }: PropsWithChildren) {
        return (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        );
      }
      const screen = await render(
        <LocationPickerScreen
          initialLocation={initialLocation}
          onConfirm={jest.fn()}
          onClose={jest.fn()}
          isConfirming={false}
        />,
        { wrapper: Wrapper },
      );
      const map = LocationPickerMap as jest.Mock;
      expect(map.mock.lastCall[0]).toMatchObject({ latitude, longitude });
      await act(async () => {
        await map.mock.lastCall[0].onLocationSelect(latitude, longitude);
      });
      expect(reverseGeocode).toHaveBeenLastCalledWith(latitude, longitude);
      expect(
        (ConfirmLocationSheet as jest.Mock).mock.lastCall[0],
      ).toMatchObject({
        isWithinServiceArea: true,
        serviceAreaFeedback: null,
      });
      await act(async () => {
        screen.unmount();
        client.clear();
      });
    }
    expect(reverseGeocode).toHaveBeenCalledTimes(2);
  });

  it("keeps verification failures distinct from an outside-area result", async () => {
    (reverseGeocode as jest.Mock).mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Unable to connect to the location service.",
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      );
    }
    const screen = await render(
      <LocationPickerScreen
        initialLocation={null}
        onConfirm={jest.fn()}
        onClose={jest.fn()}
        isConfirming={false}
      />,
      { wrapper: Wrapper },
    );
    const map = LocationPickerMap as jest.Mock;
    expect(map).toHaveBeenCalled();
    await act(async () => {
      await map.mock.lastCall[0].onLocationSelect(
        10.299255281007682,
        123.90291843563318,
      );
    });
    expect((ConfirmLocationSheet as jest.Mock).mock.lastCall[0]).toMatchObject({
      isWithinServiceArea: false,
      serviceAreaFeedback: "unavailable",
    });
    screen.unmount();
    client.clear();
  });
});
