import React from "react";
import {
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
const mockRefetchRequests = jest.fn();

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
    replace: (...args: unknown[]) => mockReplace(...args),
  },
}));
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

describe("BusinessNameChangeRequestScreen", () => {
  afterEach(async () => {
    await cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue(profile);
    mockRequests.mockReturnValue({
      pendingRequest: null,
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
      screen.getByText(/remain visible until an Admin approves/),
    ).toBeTruthy();
    await fireEvent.changeText(
      screen.getByPlaceholderText("Enter your proposed business name"),
      "Sugbo Heritage Bistro",
    );
    await fireEvent.press(screen.getByText("Submit Request"));
    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith("Sugbo Heritage Bistro");
      expect(mockReplace).toHaveBeenCalledWith(
        "/(merchant)/business-update-requests",
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
    const submitButton = screen.getByRole("button", { name: "Submit Request" });
    await fireEvent.press(submitButton);
    await fireEvent.press(submitButton);
    expect(mockSubmit).toHaveBeenCalledTimes(1);
    resolveSubmit?.({ id: 7, status: "pending" });
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
  });

  it("blocks a new request while one is pending or business is suspended", async () => {
    mockRequests.mockReturnValue({
      pendingRequest: { id: 7, proposed_business_name: "Other Bistro" },
      isLoading: false,
      error: null,
      refetch: mockRefetchRequests,
    });
    const pending = await render(<BusinessNameChangeRequestScreen />);
    expect(pending.getByText("Pending Admin review")).toBeTruthy();
    expect(pending.queryByText("Submit Request")).toBeNull();
    await pending.unmount();

    mockRequests.mockReturnValue({
      pendingRequest: null,
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
});
