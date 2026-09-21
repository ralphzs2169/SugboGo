import { fireEvent, render, waitFor } from "@testing-library/react-native";
import Toast from "react-native-toast-message";

import { openGrabBooking } from "../../../services/grabHandoff.service";
import GrabHandoffCard from "../GrabHandoffCard";

jest.mock("react-native-toast-message", () => ({
  __esModule: true,
  default: {
    show: jest.fn(),
  },
}));
jest.mock("../../../services/grabHandoff.service", () => ({
  openGrabBooking: jest.fn(),
}));

describe("GrabHandoffCard", () => {
  it("starts the Grab handoff from an explicit action", async () => {
    (openGrabBooking as jest.Mock).mockResolvedValue("opened");
    const screen = await render(<GrabHandoffCard />);

    await fireEvent.press(
      screen.getByLabelText("Continue booking in Grab"),
    );

    await waitFor(() => expect(openGrabBooking).toHaveBeenCalledTimes(1));
    expect(Toast.show).not.toHaveBeenCalled();
  });

  it("shows clear feedback when Grab is unavailable", async () => {
    (openGrabBooking as jest.Mock).mockResolvedValue("unavailable");
    const screen = await render(<GrabHandoffCard />);

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

  it("handles a failed external-app launch without exposing its error", async () => {
    (openGrabBooking as jest.Mock).mockResolvedValue("failed");
    const screen = await render(<GrabHandoffCard />);

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
