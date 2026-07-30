import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_KEY = "hasCompletedOnboarding";

/**
 * Marks the onboarding flow as completed.
 */
export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "true");
}

/**
 * Checks whether the onboarding flow has been completed.
 * @returns A promise resolving to true if onboarding has been completed.
 */
export async function hasCompletedOnboarding(): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY);
  return value === "true";
}

/**
 * Clears the onboarding completion state.
 * Intended for development and testing purposes.
 */
export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(ONBOARDING_KEY);
}
