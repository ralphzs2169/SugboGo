import { MerchantRegistrationStatus } from "../types/merchant.types";

/**
 * Configuration describing how the Merchant Portal should
 * be rendered for a specific registration status.
 */
export interface PortalConfig {
  /** Controls whether the merchant portal hero section is visible. */
  hero: boolean;

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
 * Portal rendering configuration for each merchant registration status.
 *
 * Determines which content, sections, and actions are displayed
 * throughout the merchant portal lifecycle.
 */
export const portalConfig: Record<MerchantRegistrationStatus, PortalConfig> = {
  NONE: {
    hero: true,

    profileCard: {
      title: "Become a Merchant",
      description: "Digitize your shop and reach more explorers in Cebu.",
      buttonTitle: "Open Merchant Portal",
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
    hero: false,

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
    hero: false,

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
    hero: false,

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
    hero: false,

    profileCard: {
      title: "Merchant Dashboard",
      description:
        "Manage your business, monitor performance, and engage with explorers.",
      buttonTitle: "Open Dashboard",
    },

    primaryAction: {
      buttonTitle: "Switch to Merchant Mode",
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
