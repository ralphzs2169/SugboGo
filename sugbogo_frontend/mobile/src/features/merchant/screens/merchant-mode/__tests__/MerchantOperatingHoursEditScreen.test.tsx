import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import MerchantOperatingHoursEditScreen from "../MerchantOperatingHoursEditScreen";

const mockProfile = jest.fn();
const mockUpdateOperatingHours = jest.fn();
const mockRefetch = jest.fn();

jest.mock("../../../hooks/business-profile/useMerchantBusinessProfile", () => ({
  __esModule: true,
  default: () => mockProfile(),
}));

jest.mock(
  "../../../hooks/business-profile/useUpdateMerchantOperatingHours",
  () => ({
    __esModule: true,
    default: () => ({
      updateOperatingHours: mockUpdateOperatingHours,
      isSaving: false,
    }),
  }),
);

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("expo-router", () => ({
  router: { back: jest.fn() },
  useNavigation: () => ({
    isFocused: () => true,
    setOptions: jest.fn(),
    dispatch: jest.fn(),
  }),
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

jest.mock("@react-native-community/datetimepicker", () => {
  const React = jest.requireActual("react");
  const { Pressable, Text } = jest.requireActual("react-native");

  return function MockPicker({ onChange }: { onChange: Function }) {
    return React.createElement(
      Pressable,
      {
        onPress: () => onChange({ type: "set" }, new Date(2026, 0, 1, 22, 0)),
        accessibilityLabel: "Choose 22:00",
      },
      React.createElement(Text, null, "Choose 22:00"),
    );
  };
});

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const business = {
  id: 7,
  status: "active",
  operating_hours: DAYS.map((day) => ({
    day,
    is_open: true,
    is_24_hours: false,
    open_time: "08:00:00",
    close_time: "17:00:00",
  })),
};

async function press(element: Parameters<typeof fireEvent.press>[0]) {
  await act(async () => {
    fireEvent.press(element);
  });
}

describe("MerchantOperatingHoursEditScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    mockRefetch.mockResolvedValue({ data: business, error: null });
    mockUpdateOperatingHours.mockResolvedValue([]);
  });

  it("prefills approved hours and submits the complete weekly payload", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);

    expect(screen.getAllByText(/8:00/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(true);

    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByText("Open 24 hours"));
    expect(
      screen.getByRole("button", { name: "Save Changes" }).props
        .accessibilityState.disabled,
    ).toBe(false);

    await press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateOperatingHours).toHaveBeenCalledWith({
        expected_hours: business.operating_hours,
        hours: DAYS.map((day) =>
          day === "monday"
            ? {
                day,
                is_open: true,
                is_24_hours: true,
                open_time: null,
                close_time: null,
              }
            : {
                day,
                is_open: true,
                is_24_hours: false,
                open_time: "08:00:00",
                close_time: "17:00:00",
              },
        ),
      });
      expect(router.back).toHaveBeenCalledTimes(1);
      expect(Toast.show).toHaveBeenCalledWith(
        expect.objectContaining({ type: "success" }),
      );
    });
  });

  it("copies a closed source day to a selected target", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);

    await press(screen.getByLabelText("Edit monday hours"));
    await waitFor(() => expect(screen.getByText("Open 24 hours")).toBeTruthy());
    await press(screen.getByText("Closed"));
    await press(screen.getByText("Apply schedule to other days"));
    await waitFor(() => {
      expect(screen.getByLabelText("Apply schedule to tuesday")).toBeTruthy();
    });
    await press(screen.getByLabelText("Apply schedule to tuesday"));
    await waitFor(() =>
      expect(screen.getByText("Apply to 1 day")).toBeTruthy(),
    );
    await press(screen.getByText("Apply to 1 day"));
    await press(screen.getByText("Save Changes"));

    await waitFor(() => {
      const payload = mockUpdateOperatingHours.mock.calls[0][0];
      expect(payload.hours[0]).toEqual({
        day: "monday",
        is_open: false,
        is_24_hours: false,
        open_time: null,
        close_time: null,
      });
      expect(payload.hours[1]).toEqual({
        day: "tuesday",
        is_open: false,
        is_24_hours: false,
        open_time: null,
        close_time: null,
      });
    });
  });

  it("handles 24-hour state", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);

    await press(screen.getByLabelText("Edit monday hours"));
    await waitFor(() => expect(screen.getByText("Open 24 hours")).toBeTruthy());
    await press(screen.getByText("Open 24 hours"));
    await waitFor(() => expect(screen.queryByText("Opens")).toBeNull());
  });

  it("shows overnight feedback", async () => {
    mockProfile.mockReturnValue({
      business: {
        ...business,
        operating_hours: business.operating_hours.map((hours) =>
          hours.day === "wednesday"
            ? { ...hours, open_time: "22:00:00", close_time: "02:00:00" }
            : hours,
        ),
      },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const overnight = await render(<MerchantOperatingHoursEditScreen />);
    await press(overnight.getByLabelText("Edit wednesday hours"));
    await waitFor(() => {
      expect(overnight.getByText("Closes the following day")).toBeTruthy();
    });
  });

  it("stores a native picker selection and marks the day overnight", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await waitFor(() => expect(screen.getByLabelText(/Opens:/)).toBeTruthy());
    await press(screen.getByLabelText(/Opens:/));
    await press(screen.getByLabelText("Choose 22:00"));

    await waitFor(() => {
      expect(screen.getByText("Closes the following day")).toBeTruthy();
    });

    await press(screen.getByText("Save Changes"));
    await waitFor(() => {
      expect(mockUpdateOperatingHours.mock.calls[0][0].hours[0]).toEqual({
        day: "monday",
        is_open: true,
        is_24_hours: false,
        open_time: "22:00",
        close_time: "17:00",
      });
    });
  });

  it("blocks suspended businesses", async () => {
    mockProfile.mockReturnValue({
      business: { ...business, status: "suspended" },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const suspended = await render(<MerchantOperatingHoursEditScreen />);
    expect(suspended.getByText("Editing unavailable")).toBeTruthy();
    expect(suspended.queryByText("Save Changes")).toBeNull();
  });

  it("hydrates the complete server week after an initial request", async () => {
    mockProfile.mockReturnValue({
      business: null,
      isLoading: true,
      error: null,
      refetch: mockRefetch,
    });
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    expect(screen.queryByLabelText("Edit monday hours")).toBeNull();
    mockProfile.mockReturnValue({
      business,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    await screen.rerender(<MerchantOperatingHoursEditScreen />);
    expect(screen.getByLabelText("Edit sunday hours")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });

  it("refreshes a pristine editor and submits the refreshed baseline", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    const newer = {
      ...business,
      operating_hours: business.operating_hours.map((hours) => ({
        ...hours,
        open_time: "09:00:00",
      })),
    };
    mockProfile.mockReturnValue({
      business: newer,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    await screen.rerender(<MerchantOperatingHoursEditScreen />);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(screen.queryAllByText(/8:00/)).toHaveLength(0);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByText("Open 24 hours"));
    await press(screen.getByText("Save Changes"));
    expect(mockUpdateOperatingHours).toHaveBeenCalledWith(
      expect.objectContaining({
        expected_hours: newer.operating_hours,
        hours: expect.arrayContaining([newer.operating_hours[1]]),
      }),
    );
  });

  it("does not make an equivalent reordered server week dirty", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    mockProfile.mockReturnValue({
      business: {
        ...business,
        operating_hours: [...business.operating_hours].reverse(),
      },
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    await screen.rerender(<MerchantOperatingHoursEditScreen />);
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(screen.queryByText("Operating hours changed")).toBeNull();
  });

  it("keeps a dirty draft when newer data arrives and requires explicit reconciliation", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByText("Open 24 hours"));
    const newer = {
      ...business,
      operating_hours: business.operating_hours.map((hours) =>
        hours.day === "monday"
          ? { ...hours, is_open: false, open_time: null, close_time: null }
          : { ...hours, open_time: "09:00:00" },
      ),
    };
    mockRefetch.mockResolvedValue({ data: newer, error: null });
    mockProfile.mockReturnValue({
      business: newer,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    await screen.rerender(<MerchantOperatingHoursEditScreen />);
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(mockUpdateOperatingHours).not.toHaveBeenCalled();
    await press(
      screen.getByRole("button", { name: /Tap to review latest hours/ }),
    );
    expect(screen.getByText("Latest saved hours")).toBeTruthy();
    expect(screen.getByText("Your draft")).toBeTruthy();
    await press(screen.getByText("Keep draft without merging"));
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
    await press(
      screen.getByRole("button", { name: /Tap to review latest hours/ }),
    );
    await press(screen.getByText("Keep my edited days"));
    expect(mockUpdateOperatingHours).not.toHaveBeenCalled();
    await press(screen.getByText("Save Changes"));
    const payload = mockUpdateOperatingHours.mock.calls[0][0];
    expect(payload.expected_hours).toEqual(newer.operating_hours);
    expect(payload.hours[0]).toMatchObject({
      is_open: true,
      is_24_hours: true,
    });
    expect(payload.hours[1]).toEqual(newer.operating_hours[1]);
  });

  it("preserves a rejected draft and never automatically retries a conflict", async () => {
    mockUpdateOperatingHours.mockRejectedValueOnce({
      success: false,
      code: "BUSINESS_OPERATING_HOURS_EDIT_CONFLICT",
      message: "Your operating hours changed. Your draft has been kept.",
    });
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByText("Open 24 hours"));
    await press(screen.getByText("Save Changes"));
    expect(router.back).not.toHaveBeenCalled();
    expect(screen.getByText(/Your draft has been kept/)).toBeTruthy();
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
    mockRefetch.mockResolvedValueOnce({
      data: business,
      error: new Error("Offline"),
    });
    await press(
      screen.getByRole("button", { name: /Tap to review latest hours/ }),
    );
    expect(screen.getByText(/Unable to refresh operating hours/)).toBeTruthy();
    expect(mockUpdateOperatingHours).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
  });

  it("disables save when a meaningful change is reverted", async () => {
    const closed = {
      ...business,
      operating_hours: business.operating_hours.map((hours) =>
        hours.day === "monday"
          ? { ...hours, is_open: false, open_time: null, close_time: null }
          : hours,
      ),
    };
    mockProfile.mockReturnValue({
      business: closed,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByRole("button", { name: "Open" }));
    await press(screen.getByText("Closed"));
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeDisabled();
  });
  it("keeps the hours draft when discard is cancelled and exits only after confirmation", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByRole("switch"));
    await press(screen.getByText("Cancel"));
    expect(screen.getByText("Discard operating hours changes?")).toBeTruthy();
    await press(screen.getByText("Keep Editing"));
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
    expect(router.back).not.toHaveBeenCalled();
    await press(screen.getByText("Cancel"));
    await press(screen.getByText("Discard"));
    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it("freezes the captured schedule and blocks Cancel until the save fails", async () => {
    let reject: (value: unknown) => void = () => {};
    mockUpdateOperatingHours.mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    const screen = await render(<MerchantOperatingHoursEditScreen />);
    await press(screen.getByLabelText("Edit monday hours"));
    await press(screen.getByRole("switch"));
    await press(screen.getByText("Save Changes"));
    expect(screen.getByRole("switch").props.accessibilityState.disabled).toBe(
      true,
    );
    await press(screen.getByRole("button", { name: "Save Changes" }));
    await press(screen.getByText("Cancel"));
    expect(mockUpdateOperatingHours).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    await act(() => reject({ code: "NETWORK_ERROR", message: "Try again" }));
    await waitFor(() =>
      expect(screen.getByRole("switch").props.accessibilityState.disabled).toBe(
        false,
      ),
    );
    expect(screen.getByRole("switch").props.accessibilityState.checked).toBe(
      true,
    );
  });
});

jest.mock("expo-router/react-navigation", () => ({
  usePreventRemove: jest.fn(),
}));

jest.mock(
  "expo-router/build/react-navigation/elements/Header/HeaderBackButton",
  () => ({ HeaderBackButton: () => null }),
);
