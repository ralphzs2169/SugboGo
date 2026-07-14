/**
 * Defines the structure of an onboarding screen.
 */

export interface OnboardingItem {
  id: number;
  title: string;
  description: string;
  Illustration: React.ComponentType<{
    width?: number;
    height?: number;
  }>;
}
