import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import { BackHandler } from "react-native";

import { useLocationChangeDraftStore } from "../../../stores/locationChangeDraftStore";
import { useLocationChangeReviewStore } from "../../../stores/locationChangeReviewStore";
import LocationChangeRequestScreen from "../LocationChangeRequestScreen";

const mockProfile = jest.fn();
const mockRequests = jest.fn();
const mockSubmit = jest.fn();
const mockSubmitState = { isPending: false };
const mockFocusEffect = jest.fn();
const mockSetOptions = jest.fn();
const mockNavigation = { setOptions: mockSetOptions };
const mockConfirmModal = jest.fn((_props: unknown) => null);

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useFocusEffect: (callback: unknown) => mockFocusEffect(callback),
  useNavigation: () => mockNavigation,
}));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock("../../../hooks/location-change/useMerchantLocationChanges", () => ({
  useMerchantLocationChangeRequests: () => mockRequests(),
  useSubmitMerchantLocationChange: () => ({
    mutateAsync: mockSubmit,
    isPending: mockSubmitState.isPending,
  }),
}));
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: () => undefined,
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockConfirmModal(props),
}));
jest.mock(
  "../../../components/registration/landmark/SelectedLandmarksSection",
  () => ({
    __esModule: true,
    default: () => {
      const { Text } = jest.requireActual("react-native");
      return <Text>Nearby Landmarks</Text>;
    },
  }),
);
jest.mock(
  "../../../components/registration/location/LocationPickerMap",
  () => ({
    __esModule: true,
    default: ({ onOpenPicker }: { onOpenPicker?: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable
          onPress={onOpenPicker}
          accessibilityLabel="Open location picker"
        >
          <Text>Map preview</Text>
        </Pressable>
      );
    },
  }),
);
jest.mock(
  "../../../components/location-change/LocationChangeComparison",
  () => ({
    __esModule: true,
    default: ({ title, onView }: { title: string; onView: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onView} accessibilityLabel={`View ${title}`}>
          <Text>{title}</Text>
        </Pressable>
      );
    },
  }),
);

const business = {
  id: 7,
  status: "active",
  location: {
    latitude: 10.31,
    longitude: 123.88,
    address: "Current flat address",
    city: "Cebu City",
    province: "Cebu",
    postal_code: "6000",
    landmarks: [],
  },
};

const eligible = {
  can_submit: true,
  reason: null,
  cooldown_duration_hours: 72,
  cooldown_until: null,
  last_approved_request_id: null,
  pending_request_id: null,
};

describe("Location change request form", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReset();
    mockRequests.mockReset();
    mockSubmit.mockReset();
    mockSubmitState.isPending = false;
    useLocationChangeDraftStore.getState().reset();
    useLocationChangeReviewStore.getState().clearPreview();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockRequests.mockReturnValue({
      eligibility: eligible,
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockSubmit.mockResolvedValue({ id: 22 });
  });

  it("separates the form sections and submits reviewed changes", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByText("Business location")).toBeTruthy(),
    );
    expect(screen.getByText("Address details")).toBeTruthy();
    expect(screen.getByText("Nearby Landmarks")).toBeTruthy();
    expect(
      screen.getByLabelText("Review Changes").props.accessibilityState.disabled,
    ).toBe(true);
    expect(mockSubmit).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "New flat address",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Review Changes"));
    });
    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(screen.getByText("Current flat address")).toBeTruthy();
    expect(screen.getByText("New flat address")).toBeTruthy();
    expect(screen.queryByText("Business pin")).toBeNull();
    expect(screen.queryByText("Map preview")).toBeNull();
    expect(screen.queryByText("View location on map")).toBeNull();
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Submit Request"));
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      proposed_location: {
        latitude: 10.31,
        longitude: 123.88,
        address: "New flat address",
        city: "Cebu City",
        province: "Cebu",
        postal_code: "6000",
      },
      proposed_landmarks: [],
    });
    expect(business.location.address).toBe("Current flat address");
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/(merchant)/business-update-requests/location/22",
      ),
    );
    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "New flat address",
    );
    await screen.unmount();
    expect(useLocationChangeDraftStore.getState().location).toBeNull();
  });

  it("navigates once when the request list observes the new pending request", async () => {
    let resolveSubmit: (result: { id: number }) => void = () => undefined;
    mockSubmit.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );

    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "New flat address",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Review Changes"));
    });
    const headerConfigurationCount = mockSetOptions.mock.calls.length;
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Submit Request"));
    });

    mockRequests.mockReturnValue({
      pendingRequest: { id: 22 },
      hasData: true,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    mockSubmitState.isPending = true;
    await screen.rerender(<LocationChangeRequestScreen />);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.queryByText("Pending Admin review")).toBeNull();
    expect(
      screen.getByLabelText("Submit Request").props.accessibilityState.busy,
    ).toBe(true);

    await act(async () => {
      mockSubmitState.isPending = false;
      resolveSubmit({ id: 22 });
    });
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(
        "/(merchant)/business-update-requests/location/22",
      ),
    );
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(
      screen.getByLabelText("Submit Request").props.accessibilityState.busy,
    ).toBe(true);
    await screen.rerender(<LocationChangeRequestScreen />);
    expect(router.replace).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(mockSetOptions).toHaveBeenCalledTimes(headerConfigurationCount);
    await screen.unmount();
    expect(useLocationChangeDraftStore.getState().location).toBeNull();
  });

  it("keeps the review and draft available after a failed submission", async () => {
    mockSubmit.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Unable to submit the request.",
      errors: {},
    });

    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "New flat address",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Review Changes"));
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Submit Request"));
    });

    expect(screen.getByText("Address changes")).toBeTruthy();
    expect(screen.getByText("Unable to submit the request.")).toBeTruthy();
    expect(
      screen.getByLabelText("Submit Request").props.accessibilityState.busy,
    ).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "New flat address",
    );
    await screen.unmount();
  });

  it("shows a persistent retry state when request history fails", async () => {
    const refetch = jest.fn();
    mockRequests.mockReturnValue({
      pendingRequest: null,
      hasData: false,
      isLoading: false,
      error: new Error("Network unavailable"),
      refetch,
    });
    const screen = await render(<LocationChangeRequestScreen />);

    await waitFor(() =>
      expect(screen.getByText("Unable to load location request")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.press(screen.getByText("Retry"));
    });
    expect(refetch).toHaveBeenCalled();
    await screen.unmount();
  });

  it("confirms discard on the form Cancel action and clears the draft", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "Unsaved address",
      );
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText("Cancel"));
    });
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    await waitFor(() => expect(router.back).toHaveBeenCalled());
    expect(useLocationChangeDraftStore.getState().location).toBeNull();
    await screen.unmount();

    const reopened = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(reopened.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    expect(reopened.queryByDisplayValue("Unsaved address")).toBeNull();
    await reopened.unmount();
  });

  it("guards header Back and retains changes when discard is canceled", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "Unsaved address",
      );
    });
    const headerLeft = mockSetOptions.mock.lastCall[0].headerLeft;
    const headerBackButton = headerLeft();

    await act(async () => {
      headerBackButton.props.onPress();
    });
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onCancel();
    });
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "Unsaved address",
    );
    expect(router.back).not.toHaveBeenCalled();

    await act(async () => {
      headerBackButton.props.onPress();
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    await waitFor(() => expect(router.back).toHaveBeenCalledTimes(1));
    expect(useLocationChangeDraftStore.getState().location).toBeNull();
    await screen.unmount();
  });

  it("confirms discard when Android Back is pressed", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "Unsaved address",
      );
    });

    let handleBack: (() => boolean | null | undefined) | undefined;
    const remove = jest.fn();
    const addEventListener = jest
      .spyOn(BackHandler, "addEventListener")
      .mockImplementation((_event, callback) => {
        handleBack = () => callback({} as never);
        return { remove };
      });
    const onFocus = mockFocusEffect.mock.lastCall[0];
    const onBlur = onFocus();

    await act(async () => {
      expect(handleBack?.()).toBe(true);
    });
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    expect(router.back).not.toHaveBeenCalled();

    onBlur();
    expect(remove).toHaveBeenCalled();
    addEventListener.mockRestore();
    await screen.unmount();
  });

  it("keeps the draft while opening the location picker", async () => {
    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByDisplayValue("Current flat address")).toBeTruthy(),
    );
    await act(async () => {
      fireEvent.changeText(
        screen.getByDisplayValue("Current flat address"),
        "Unsaved address",
      );
    });
    await act(async () => {
      fireEvent.press(screen.getByLabelText("Open location picker"));
    });
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/location-change/picker",
    );
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(
      false,
    );
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "Unsaved address",
    );
    await screen.unmount();
    expect(useLocationChangeDraftStore.getState().location?.address).toBe(
      "Unsaved address",
    );
  });

  it("shows an existing pending request without navigating automatically", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        ...eligible,
        can_submit: false,
        reason: "pending",
        pending_request_id: 33,
      },
      pendingRequest: { id: 33 },
      hasData: true,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<LocationChangeRequestScreen />);
    await waitFor(() =>
      expect(screen.getByText("Pending Admin review")).toBeTruthy(),
    );
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText("View Request"));
    });
    expect(router.replace).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/location/33",
    );
    await screen.unmount();
  });

  it("shows location cooldown and opens the approved request", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        can_submit: false,
        reason: "cooldown",
        cooldown_duration_hours: 72,
        cooldown_until: "2026-10-12T07:00:00Z",
        last_approved_request_id: 61,
        pending_request_id: null,
      },
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    const screen = await render(<LocationChangeRequestScreen />);

    expect(screen.getByText("Change temporarily unavailable")).toBeTruthy();
    expect(screen.getByText("72 hours")).toBeTruthy();
    expect(screen.queryByText("Review Changes")).toBeNull();
    await fireEvent.press(screen.getByText("View Approved Request"));
    expect(router.push).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/location/61",
    );
    await screen.unmount();
  });
});
