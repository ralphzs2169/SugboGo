import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { openGrabBooking } from "../../../services/grabHandoff.service";
import RideProviderSheet from "../RideProviderSheet";

jest.mock("@gorhom/bottom-sheet", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require("react-native");

  return {
    BottomSheetModal: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
    BottomSheetBackdrop: () => null,
    BottomSheetView: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));
jest.mock("../../../services/grabHandoff.service", () => ({
  openGrabBooking: jest.fn(),
}));

describe("RideProviderSheet", () => {
  it("reuses the verified Grab handoff and closes after opening", async () => {
    const dismiss = jest.fn();
    const sheetRef = {
      current: { dismiss },
    } as never;
    (openGrabBooking as jest.Mock).mockResolvedValue("opened");
    const screen = await render(<RideProviderSheet sheetRef={sheetRef} />);

    await fireEvent.press(
      screen.getByLabelText("Continue booking in Grab"),
    );

    await waitFor(() => expect(openGrabBooking).toHaveBeenCalledTimes(1));
    expect(dismiss).toHaveBeenCalled();
  });

  it("keeps the existing unavailable-Grab feedback", async () => {
    const sheetRef = {
      current: { dismiss: jest.fn() },
    } as never;
    (openGrabBooking as jest.Mock).mockResolvedValue("unavailable");
    const screen = await render(<RideProviderSheet sheetRef={sheetRef} />);

    await fireEvent.press(
      screen.getByLabelText("Continue booking in Grab"),
    );

    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith({
        type: "error",
        text1: "Grab isn't available on this device.",
      }),
    );
  });

  it("handles a rejected Grab launch without exposing the raw error", async () => {
    const sheetRef = {
      current: { dismiss: jest.fn() },
    } as never;
    (openGrabBooking as jest.Mock).mockResolvedValue("failed");
    const screen = await render(<RideProviderSheet sheetRef={sheetRef} />);

    await fireEvent.press(
      screen.getByLabelText("Continue booking in Grab"),
    );

    await waitFor(() =>
      expect(Toast.show).toHaveBeenCalledWith({
        type: "error",
        text1: "Unable to open Grab.",
        text2: "Please try again.",
      }),
    );
  });
});
