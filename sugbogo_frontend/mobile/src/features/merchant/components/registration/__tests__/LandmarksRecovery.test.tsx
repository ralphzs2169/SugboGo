import { act, fireEvent, render } from "@testing-library/react-native";
import { FormProvider, useForm } from "react-hook-form";

import { useAuthStore } from "@/features/auth/store/auth.store";
import type { User } from "@/features/users/types/user.types";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import type {
  BusinessLandmark,
  BusinessLocation,
} from "@/shared/types/BusinessLocation.types";
import { MERCHANT_REGISTRATION_DEFAULT_VALUES } from "../../../constants/registration/defaultValues.constants";
import { useMerchantRegistrationStore } from "../../../stores/merchantRegistrationStore";
import LandmarksSection from "../landmark/LandmarksSection";

const mockSearch = jest.fn();
jest.mock("../../../hooks/location-selection/useNearbyLandmarks", () => ({
  __esModule: true,
  default: () => ({ searchNearbyLandmarks: mockSearch }),
}));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("@expo/vector-icons", () => ({ MaterialCommunityIcons: () => null }));

const custom: BusinessLandmark = {
  id: "custom-1",
  name: "My custom landmark",
  address: "Cebu City",
  latitude: 10.3,
  longitude: 123.9,
  source: "custom",
};
const suggested = {
  ...custom,
  id: "google-1",
  name: "Nearby plaza",
  source: "google" as const,
};
const location = {
  latitude: 10.3,
  longitude: 123.9,
} as BusinessLocation;

function Form({ disabled = false }: { disabled?: boolean }) {
  const form = useForm({
    defaultValues: MERCHANT_REGISTRATION_DEFAULT_VALUES,
    disabled,
  });
  return (
    <FormProvider {...form}>
      <LandmarksSection />
    </FormProvider>
  );
}

describe("registration landmark recovery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    useAuthStore.setState({ user: { id: 1 } as User, isAuthenticated: true });
    useMerchantRegistrationStore.setState({
      selectedLocation: location,
      selectedLandmarks: [custom],
      nearbyLandmarksLoadFailed: true,
    });
  });

  it("keeps custom cards, count and removal available alongside lookup failure", async () => {
    const screen = await render(<Form />);
    expect(screen.getByText("Couldn't load nearby landmarks")).toBeTruthy();
    expect(screen.getByText(custom.name)).toBeTruthy();
    expect(screen.getByText("Selected: 1 / 5")).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`Remove ${custom.name}`));
    expect(screen.queryByText(custom.name)).toBeNull();
    expect(useMerchantRegistrationStore.getState().selectedLandmarks).toEqual(
      [],
    );
  });

  it("preserves custom additions during failed Retry and merges suggestions after success", async () => {
    mockSearch.mockResolvedValueOnce({ success: false, landmarks: [] });
    const screen = await render(<Form />);
    await fireEvent.press(screen.getByText("Retry nearby landmarks"));
    expect(screen.getByText(custom.name)).toBeTruthy();
    expect(screen.getByText("Couldn't load nearby landmarks")).toBeTruthy();
    let finish!: (value: {
      success: boolean;
      landmarks: BusinessLandmark[];
    }) => void;
    mockSearch.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await fireEvent.press(screen.getByText("Retry nearby landmarks"));
    const added = {
      ...custom,
      id: "custom-2",
      name: "Another custom landmark",
    };
    await act(async () => {
      useMerchantRegistrationStore
        .getState()
        .setSelectedLandmarks([custom, added]);
      finish({ success: true, landmarks: [suggested] });
    });
    expect(screen.getByText(custom.name)).toBeTruthy();
    expect(screen.getByText(added.name)).toBeTruthy();
    expect(screen.getByText(suggested.name)).toBeTruthy();
    expect(screen.getByText("Selected: 3 / 5")).toBeTruthy();
    expect(screen.queryByText("Couldn't load nearby landmarks")).toBeNull();
  });

  it.each(["session", "save", "unmount"])(
    "ignores Retry completion after %s invalidation",
    async (transition) => {
      let finish!: (value: {
        success: boolean;
        landmarks: BusinessLandmark[];
      }) => void;
      mockSearch.mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        }),
      );
      const screen = await render(<Form />);
      await fireEvent.press(screen.getByText("Retry nearby landmarks"));
      if (transition === "session") {
        await act(async () => {
          beginAuthSession();
        });
      } else if (transition === "save") {
        await screen.rerender(<Form disabled />);
        await screen.rerender(<Form />);
      } else {
        await screen.unmount();
      }
      const before = useMerchantRegistrationStore.getState().selectedLandmarks;
      await act(async () => {
        finish({ success: true, landmarks: [suggested] });
      });
      expect(useMerchantRegistrationStore.getState().selectedLandmarks).toEqual(
        before,
      );
      expect(
        useMerchantRegistrationStore.getState().selectedLandmarks,
      ).not.toContainEqual(suggested);
    },
  );
});
