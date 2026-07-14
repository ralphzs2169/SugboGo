import AuthenticGemsIllustration from "../illustrations/authentic-gems.svg";
import DiscoverIllustration from "../illustrations/discover.svg";
import GetStartedIllustration from "../illustrations/get-started.svg";
import LocalNavigationIllustration from "../illustrations/local-navigation.svg";

import { OnboardingItem } from "../types";

/**
 * Static content for the onboarding screens.
 */
export const onboardingData: OnboardingItem[] = [
  {
    id: 1,
    title: "The Heart of Discovery",
    description:
      "Uncover the soul of Cebu. Discover hidden heritage sites, artisan workshops, and local flavors beyond the usual tourist spots.",
    Illustration: DiscoverIllustration,
  },
  {
    id: 2,
    title: "Authentic Gems First",
    description:
      "Specialty over popularity. Explore unique local businesses and culturally rich destinations chosen for their authenticity.",
    Illustration: AuthenticGemsIllustration,
  },
  {
    id: 3,
    title: "Guided by Local Wisdom",
    description:
      "Navigate like a true local. Find your way with landmark-based directions and jeepney routes designed for Cebu's streets.",
    Illustration: LocalNavigationIllustration,
  },
  {
    id: 4,
    title: "Your Journey Begins",
    description:
      "Start your Cebu adventure. Support local businesses, discover unforgettable places, and create experiences worth remembering.",
    Illustration: GetStartedIllustration,
  },
];
