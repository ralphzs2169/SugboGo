import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react-native";

import BusinessNameChangeRequestScreen from "../BusinessNameChangeRequestScreen";

const mockProfile = jest.fn();
const mockRequests = jest.fn();
const mockSubmit = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockRefetchRequests = jest.fn();
const mockBack = jest.fn();
const mockSetOptions = jest.fn();
const mockConfirmModal = jest.fn((_props: unknown) => null);

jest.mock("expo-router", () => ({
  router: {
    back: () => mockBack(),
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
  useNavigation: () => ({ setOptions: mockSetOptions }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({
    HeaderBackButton: ({ onPress }: { onPress: () => void }) => {
      const { Pressable, Text } = jest.requireActual("react-native");
      return (
        <Pressable onPress={onPress} accessibilityLabel="Back">
          <Text>Back</Text>
        </Pressable>
      );
    },
  }),
);
jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));
jest.mock(
  "../../../hooks/business-name-change/useMerchantBusinessNameChanges",
  () => ({
    useMerchantBusinessNameChangeRequests: () => mockRequests(),
    useSubmitMerchantBusinessNameChange: () => ({
      mutateAsync: mockSubmit,
      isPending: false,
    }),
  }),
);
jest.mock("@/shared/hooks/useQueryErrorNotification", () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock("@/shared/components/modals/ConfirmModal", () => ({
  __esModule: true,
  default: (props: unknown) => mockConfirmModal(props),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const profile = {
  business: { id: 10, business_name: "Sugbo Bistro", status: "active" },
  isLoading: false,
  error: null,
  refetch: jest.fn(),
};

const eligible = {
  can_submit: true,
  reason: null,
  cooldown_duration_hours: 168,
  cooldown_until: null,
  last_approved_request_id: null,
  pending_request_id: null,
};

describe("BusinessNameChangeRequestScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue(profile);
    mockRequests.mockReturnValue({
      eligibility: eligible,
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    mockSubmit.mockResolvedValue({ id: 7, status: "pending" });
  });

  it("shows the live name and submits only the proposed name", async () => {
    const screen = await render(<BusinessNameChangeRequestScreen />);
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
    expect(
      screen.getByText(/stays visible until an Admin approves/),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Sugbo Heritage Bistro",
    );
    await fireEvent.press(screen.getByText("Review Changes"));
    expect(screen.getByText("Business name change")).toBeTruthy();
    expect(screen.getByText("Proposed")).toBeTruthy();
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith("Sugbo Heritage Bistro");
      expect(mockReplace).toHaveBeenCalledWith(
        "/(merchant)/business-update-requests/7",
      );
    });
    expect(screen.getByText("Sugbo Bistro")).toBeTruthy();
  });

  it("keeps a backend field error on the input", async () => {
    mockSubmit.mockRejectedValue({
      success: false,
      code: "VALIDATION_ERROR",
      message: "Business name is invalid.",
      errors: { proposed_business_name: ["Business name is invalid."] },
    });
    const screen = await render(<BusinessNameChangeRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Other Name",
    );
    await fireEvent.press(screen.getByText("Review Changes"));
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() =>
      expect(screen.getByText("Business name is invalid.")).toBeTruthy(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("prevents a second submission while the first request is saving", async () => {
    let resolveSubmit: ((value: unknown) => void) | undefined;
    mockSubmit.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSubmit = resolve;
        }),
    );
    const screen = await render(<BusinessNameChangeRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Sugbo Heritage Bistro",
    );
    await fireEvent.press(screen.getByText("Review Changes"));
    const submitButton = screen.getByRole("button", { name: "Submit Request" });
    await fireEvent.press(submitButton);
    await fireEvent.press(submitButton);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.({ id: 7, status: "pending" });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it("blocks a new request while one is pending or business is suspended", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        ...eligible,
        can_submit: false,
        reason: "pending",
        pending_request_id: 7,
      },
      pendingRequest: { id: 7, proposed_business_name: "Other Bistro" },
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    const pending = await render(<BusinessNameChangeRequestScreen />);
    expect(pending.getByText("Pending Admin review")).toBeTruthy();
    expect(pending.queryByText("Submit Request")).toBeNull();
    await pending.unmount();

    mockRequests.mockReturnValue({
      eligibility: eligible,
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    mockProfile.mockReturnValue({
      ...profile,
      business: { ...profile.business, status: "suspended" },
    });
    const suspended = await render(<BusinessNameChangeRequestScreen />);
    expect(suspended.getByText("Request unavailable")).toBeTruthy();
    expect(suspended.queryByText("Submit Request")).toBeNull();
    await suspended.unmount();
  });

  it("disables review until the proposed name differs from the live name", async () => {
    const screen = await render(<BusinessNameChangeRequestScreen />);
    expect(screen.getByDisplayValue("Sugbo Bistro")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Review Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Other Bistro",
    );
    expect(
      screen.getByRole("button", { name: "Review Changes" }).props
        .accessibilityState.disabled,
    ).toBe(false);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Sugbo Bistro",
    );
    expect(
      screen.getByRole("button", { name: "Review Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);
  });

  it("shows cooldown availability and opens the approved request", async () => {
    mockRequests.mockReturnValue({
      eligibility: {
        can_submit: false,
        reason: "cooldown",
        cooldown_duration_hours: 168,
        cooldown_until: "2026-10-16T07:00:00Z",
        last_approved_request_id: 42,
        pending_request_id: null,
      },
      pendingRequest: null,
      hasData: true,
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });

    const screen = await render(<BusinessNameChangeRequestScreen />);

    expect(screen.getByText("Change temporarily unavailable")).toBeTruthy();
    expect(screen.getByText("7 days")).toBeTruthy();
    expect(screen.queryByText("Review Changes")).toBeNull();
    await fireEvent.press(screen.getByText("View Approved Request"));
    expect(mockPush).toHaveBeenCalledWith(
      "/(merchant)/business-update-requests/42",
    );
  });

  it("confirms discarding a changed name from Cancel and header Back", async () => {
    const screen = await render(<BusinessNameChangeRequestScreen />);
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Other Bistro",
    );
    await fireEvent.press(screen.getByText("Cancel"));
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onCancel();
    });

    const headerLeft = mockSetOptions.mock.lastCall?.[0].headerLeft;
    const header = await render(headerLeft());
    await fireEvent.press(header.getByLabelText("Back"));
    expect((mockConfirmModal as jest.Mock).mock.lastCall[0].visible).toBe(true);
    expect(mockBack).not.toHaveBeenCalled();
    await act(async () => {
      (mockConfirmModal as jest.Mock).mock.lastCall[0].onConfirm();
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
