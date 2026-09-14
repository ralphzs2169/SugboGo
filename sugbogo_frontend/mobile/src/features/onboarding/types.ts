import type { ImageSource } from "expo-image";

/**
 * Defines the content displayed by an onboarding screen.
 */
export interface OnboardingItem {
  id: number;
  title: string;
  description: string;
  imageSource: ImageSource;
}
