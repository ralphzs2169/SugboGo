import { MerchantRegistrationStatus } from "../types/merchant.types";

/**
 * Configuration describing how the Merchant Portal should
 * be rendered for a specific registration status.
 */
export interface PortalConfig {
  /** Hero content displayed on the Merchant Portal. */
  hero: {
    title: string;
    description: string;
  };

  /** Content displayed on the profile merchant card. */
  profileCard: {
    title: string;
    description: string;
    buttonTitle: string;
  };

  /** Primary action displayed at the bottom of the portal. */
  primaryAction: {
    buttonTitle: string;
  };

  /** Controls which portal sections are visible. */
  sections: {
    benefits: boolean;
    requirements: boolean;
    progress: boolean;
    status: boolean;
    feedback: boolean;
    dashboard: boolean;
  };
}

/**
 * Configuration describing how the Merchant Portal should
 * be rendered for each registration status.
 *
 * Each status determines:
 * - Hero content
 * - Primary action
 * - Visible portal sections
 */

export const portalConfig: Record<MerchantRegistrationStatus, PortalConfig> = {
  NONE: {
    hero: {
      title: "Become a SugboGo Merchant",
      description:
        "Register your business to reach more explorers, grow your presence, and manage your business through SugboGo.",
    },
    profileCard: {
      title: "Become a Merchant",
      description: "Digitize your shop and reach more explorers in Cebu.",
      buttonTitle: "Start Registration",
    },
    primaryAction: {
      buttonTitle: "Start Registration",
    },
    sections: {
      benefits: true,
      requirements: true,
      progress: false,
      status: false,
      feedback: false,
      dashboard: false,
    },
  },

  DRAFT: {
    hero: {
      title: "Continue Your Registration",
      description:
        "Your application has been saved. Continue where you left off.",
    },

    profileCard: {
      title: "Continue Registration",
      description: "Resume your merchant application at any time.",
      buttonTitle: "Continue",
    },

    primaryAction: {
      buttonTitle: "Continue Registration",
    },

    sections: {
      benefits: false,
      requirements: false,
      progress: true,
      status: false,
      feedback: false,
      dashboard: false,
    },
  },

  SUBMITTED: {
    hero: {
      title: "Application Submitted",
      description:
        "Your application is currently being reviewed by our administrators.",
    },

    profileCard: {
      title: "Application Under Review",
      description:
        "We're reviewing your business registration. We'll notify you once a decision has been made.",
      buttonTitle: "View Status",
    },

    primaryAction: {
      buttonTitle: "View Application",
    },

    sections: {
      benefits: false,
      requirements: false,
      progress: false,
      status: true,
      feedback: false,
      dashboard: false,
    },
  },

  REJECTED: {
    hero: {
      title: "Application Requires Changes",
      description:
        "Your application needs additional updates before it can be approved.",
    },

    profileCard: {
      title: "Action Required",
      description:
        "Your application needs revisions before it can be reviewed again.",
      buttonTitle: "Review Feedback",
    },

    primaryAction: {
      buttonTitle: "Continue Editing",
    },

    sections: {
      benefits: false,
      requirements: false,
      progress: false,
      status: false,
      feedback: true,
      dashboard: false,
    },
  },

  APPROVED: {
    hero: {
      title: "Welcome, Merchant!",
      description:
        "Your business has been approved and is now part of SugboGo.",
    },

    profileCard: {
      title: "Merchant Dashboard",
      description:
        "Manage your business, monitor performance, and engage with explorers.",
      buttonTitle: "Open Dashboard",
    },

    primaryAction: {
      buttonTitle: "Go to Merchant Dashboard",
    },

    sections: {
      benefits: false,
      requirements: false,
      progress: false,
      status: false,
      feedback: false,
      dashboard: true,
    },
  },
};
