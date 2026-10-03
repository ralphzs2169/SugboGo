import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Toast from "react-native-toast-message";

import MerchantOperatingHoursEditScreen from "../MerchantOperatingHoursEditScreen";

const mockProfile = jest.fn();
const mockUpdateOperatingHours = jest.fn();

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
      refetch: jest.fn(),
    });
    mockUpdateOperatingHours.mockResolvedValue([]);
  });

  it("prefills approved hours and submits the complete weekly payload", async () => {
    const screen = await render(<MerchantOperatingHoursEditScreen />);

    expect(screen.getAllByText(/8:00/).length).toBeGreaterThan(0);
    await press(screen.getByText("Save Changes"));

    await waitFor(() => {
      expect(mockUpdateOperatingHours).toHaveBeenCalledWith({
        hours: DAYS.map((day) => ({
          day,
          is_open: true,
          is_24_hours: false,
          open_time: "08:00",
          close_time: "17:00",
        })),
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
});
