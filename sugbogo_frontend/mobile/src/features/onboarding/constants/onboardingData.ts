import type { OnboardingItem } from "../types";

const MASCOT_EXPLORE_CEBU = require("../assets/explore-cebu.webp");

const MASCOT_DISCOVER_HIDDEN_GEMS = require("../assets/discover-hidden-gems.webp");

const MASCOT_EXPLORE_WHAT_FITS_YOU = require("../assets/explore-what-fits-you.webp");

const MASCOT_FIND_YOUR_WAY = require("../assets/find-your-way.webp");

/**
 * Static content for the onboarding screens.
 */
export const onboardingData: OnboardingItem[] = [
  {
    id: 1,
    title: "Discover More of Cebu",
    description:
      "Discover local places, experiences, and businesses you might otherwise miss.",
    imageSource: MASCOT_EXPLORE_CEBU,
  },
  {
    id: 2,
    title: "Find the Places Others Miss",
    description:
      "Discover hidden gems, new local businesses, and special places worth finding around Cebu.",
    imageSource: MASCOT_DISCOVER_HIDDEN_GEMS,
  },
  {
    id: 3,
    title: "Explore What Fits You",
    description:
      "Choose what interests you and discover local places that better match what you enjoy.",
    imageSource: MASCOT_EXPLORE_WHAT_FITS_YOU,
  },
  {
    id: 4,
    title: "Find Your Way There",
    description:
      "Visualize routes, follow local transit and landmark guidance, or continue your journey with available ride options.",
    imageSource: MASCOT_FIND_YOUR_WAY,
  },
];
