import * as Linking from "expo-linking";

import {
  GRAB_BOOKING_DEEP_LINK,
  openGrabBooking,
} from "../grabHandoff.service";

jest.mock("expo-linking", () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));

describe("Grab booking handoff", () => {
  it("opens the supported Grab booking deep link", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockResolvedValue(true);

    await expect(openGrabBooking()).resolves.toBe("opened");

    expect(Linking.canOpenURL).toHaveBeenCalledWith(GRAB_BOOKING_DEEP_LINK);
    expect(Linking.openURL).toHaveBeenCalledWith(GRAB_BOOKING_DEEP_LINK);
  });

  it("reports unavailable without attempting to open Grab", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    await expect(openGrabBooking()).resolves.toBe("unavailable");

    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("safely normalizes rejected availability checks", async () => {
    (Linking.canOpenURL as jest.Mock).mockRejectedValue(
      new Error("Android package visibility failure"),
    );

    await expect(openGrabBooking()).resolves.toBe("failed");
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("safely normalizes rejected deep-link opening", async () => {
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValue(
      new Error("Unable to launch external app"),
    );

    await expect(openGrabBooking()).resolves.toBe("failed");
  });

  it("coalesces repeated handoff attempts while one is pending", async () => {
    let finishAvailabilityCheck: ((supported: boolean) => void) | undefined;
    (Linking.canOpenURL as jest.Mock).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishAvailabilityCheck = resolve;
        }),
    );
    (Linking.openURL as jest.Mock).mockResolvedValue(true);

    const firstAttempt = openGrabBooking();
    const repeatedAttempt = openGrabBooking();

    expect(repeatedAttempt).toBe(firstAttempt);
    expect(Linking.canOpenURL).toHaveBeenCalledTimes(1);

    finishAvailabilityCheck?.(true);

    await expect(firstAttempt).resolves.toBe("opened");
    expect(Linking.openURL).toHaveBeenCalledTimes(1);
  });
});
