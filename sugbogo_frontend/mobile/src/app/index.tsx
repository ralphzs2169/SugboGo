import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import AppSplash from "@/shared/components/AppSplash";
import * as onboardingStorage from "@/shared/services/onboardingStorage";
import { useAuthStore } from "@/features/auth/store/auth.store";

export default function Index() {
  const [completedOnboarding, setCompletedOnboarding] = useState<
    boolean | null
  >(null);

  const { user, isAuthenticated, isLoading } = useAuthStore();

  console.log({
    user,
    isAuthenticated,
    isLoading,
    completedOnboarding,
  });

  console.log("interest status:", user?.has_completed_interest_selection);
  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await onboardingStorage.hasCompletedOnboarding();

      setCompletedOnboarding(completed);
    };

    checkOnboarding();
  }, []);

  /**
   * Wait until:
   * - onboarding status is loaded
   * - authentication restoration is finished
   */
  if (completedOnboarding === null || isLoading) {
    return <AppSplash />;
  }

  /**
   * New user:
   * Show onboarding first.
   */
  if (!completedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  /**
   * No active session:
   * Go to authentication.
   */
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  /**
   * Logged-in user who skipped or finished interest selection.
   */
  if (!user?.has_completed_interest_selection) {
    return <Redirect href="/(setup)/interests" />;
  }

  /**
   * Fully authenticated user.
   */
  return <Redirect href="/(explorer)/(tabs)/explore" />;
}
