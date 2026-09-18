import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";

import {
  MAXIM_ANDROID_PACKAGE,
  MOVE_IT_ANDROID_PACKAGE,
  openMaxim,
  openMoveIt,
} from "../rideProviderHandoff.service";

jest.mock("expo-intent-launcher", () => ({
  openApplication: jest.fn(),
}));
jest.mock("expo-linking", () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
}));
jest.mock("react-native", () => ({
  Platform: {
    OS: "android",
  },
}));

describe("Android ride-provider handoff", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("opens Move It using its Android package name", async () => {
    await expect(openMoveIt()).resolves.toBe("opened");

    expect(IntentLauncher.openApplication).toHaveBeenCalledWith(
      MOVE_IT_ANDROID_PACKAGE,
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("opens Maxim using its Android package name", async () => {
    await expect(openMaxim()).resolves.toBe("opened");

    expect(IntentLauncher.openApplication).toHaveBeenCalledWith(
      MAXIM_ANDROID_PACKAGE,
    );
    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it.each([
    ["Move It", MOVE_IT_ANDROID_PACKAGE, openMoveIt],
    ["Maxim", MAXIM_ANDROID_PACKAGE, openMaxim],
  ])(
    "opens the %s Play Store listing when the app is unavailable",
    async (_providerName, packageName, openProvider) => {
      (IntentLauncher.openApplication as jest.Mock).mockImplementation(() => {
        throw new Error("Package not found");
      });
      (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
      (Linking.openURL as jest.Mock).mockResolvedValue(true);

      await expect(openProvider()).resolves.toBe("store-opened");

      const storeUrl =
        `https://play.google.com/store/apps/details?id=${packageName}`;
      expect(Linking.canOpenURL).toHaveBeenCalledWith(storeUrl);
      expect(Linking.openURL).toHaveBeenCalledWith(storeUrl);
    },
  );

  it("fails safely when neither the app nor Play Store can open", async () => {
    (IntentLauncher.openApplication as jest.Mock).mockImplementation(() => {
      throw new Error("Package not found");
    });
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(false);

    await expect(openMoveIt()).resolves.toBe("failed");

    expect(Linking.openURL).not.toHaveBeenCalled();
  });

  it("fails safely when opening the Play Store listing rejects", async () => {
    (IntentLauncher.openApplication as jest.Mock).mockImplementation(() => {
      throw new Error("Package not found");
    });
    (Linking.canOpenURL as jest.Mock).mockResolvedValue(true);
    (Linking.openURL as jest.Mock).mockRejectedValue(
      new Error("Unable to open Play Store"),
    );

    await expect(openMaxim()).resolves.toBe("failed");
  });
});
