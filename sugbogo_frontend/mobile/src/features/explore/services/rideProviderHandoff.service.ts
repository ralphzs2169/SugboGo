import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

export const MOVE_IT_ANDROID_PACKAGE = "com.moveit.app.customer";
export const MAXIM_ANDROID_PACKAGE = "com.taxsee.taxsee";

export type RideProviderHandoffResult =
  | "opened"
  | "store-opened"
  | "failed";

function getPlayStoreUrl(packageName: string) {
  return `https://play.google.com/store/apps/details?id=${packageName}`;
}

async function openAndroidRideProvider(
  packageName: string,
): Promise<RideProviderHandoffResult> {
  if (Platform.OS !== "android") {
    return "failed";
  }

  try {
    IntentLauncher.openApplication(packageName);
    return "opened";
  } catch {
    const storeUrl = getPlayStoreUrl(packageName);

    try {
      const canOpenStore = await Linking.canOpenURL(storeUrl);

      if (!canOpenStore) {
        return "failed";
      }

      await Linking.openURL(storeUrl);
      return "store-opened";
    } catch {
      return "failed";
    }
  }
}

/** Opens Move It or falls back to its Google Play Store listing. */
export function openMoveIt(): Promise<RideProviderHandoffResult> {
  return openAndroidRideProvider(MOVE_IT_ANDROID_PACKAGE);
}

/** Opens Maxim or falls back to its Google Play Store listing. */
export function openMaxim(): Promise<RideProviderHandoffResult> {
  return openAndroidRideProvider(MAXIM_ANDROID_PACKAGE);
}
