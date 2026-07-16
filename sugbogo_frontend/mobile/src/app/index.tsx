import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import * as onboardingStorage from "@/shared/services/onboardingStorage";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { useVerificationStore } from "@/features/auth/store/verification.store";

export default function Index() {
  const [completedOnboarding, setCompletedOnboarding] = useState<
    boolean | null
  >(null);

  const { user, isAuthenticated } = useAuthStore();

  const pendingEmail = useVerificationStore((state) => state.pendingEmail);

  useEffect(() => {
    async function checkOnboarding() {
      const completed = await onboardingStorage.hasCompletedOnboarding();

      setCompletedOnboarding(completed);
    }

    checkOnboarding();
  }, []);

  if (completedOnboarding === null) {
    return null;
  }

  if (!completedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  // If the user is not authenticated, redirect to the login page
  // or email verification page if there's a pending email.
  if (!isAuthenticated) {
    if (pendingEmail) {
      return (
        <Redirect
          href={{
            pathname: "/(auth)/verify-email",
            params: {
              email: pendingEmail,
            },
          }}
        />
      );
    }

    return <Redirect href="/(auth)/login" />;
  }

  if (!user?.has_completed_interest_selection) {
    return <Redirect href="/(setup)/interests" />;
  }

  return <Redirect href="/(explorer)/(tabs)/explore" />;
}
