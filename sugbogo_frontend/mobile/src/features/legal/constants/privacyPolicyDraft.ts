/** Ordered development-review copy supplied by the team; not approved for publication. */
export type PrivacyPolicyDraftBlock =
  | { readonly type: "paragraph" | "subheading"; readonly text: string }
  | {
      readonly type: "list";
      readonly ordered: boolean;
      readonly items: readonly string[];
    };

export type PrivacyPolicyDraftSection = {
  readonly id: string;
  readonly heading: string;
  readonly blocks: readonly PrivacyPolicyDraftBlock[];
};

export const PRIVACY_POLICY_DRAFT: readonly PrivacyPolicyDraftSection[] = [
  {
    id: "introduction",
    heading: "1. Introduction",
    blocks: [
      {
        type: "paragraph",
        text: "Welcome to SugboGo.",
      },
      {
        type: "paragraph",
        text: "SugboGo is a student-developed mobile application designed to help users discover local businesses, explore their specialties, share experiences, and support local establishments.",
      },
      {
        type: "paragraph",
        text: "We recognize the importance of protecting personal information and being transparent about how information is collected, used, stored, and shared when users interact with the application.",
      },
      {
        type: "paragraph",
        text: "This draft explains the personal information processed through SugboGo, the purposes of that processing, and the controls currently available to users.",
      },
    ],
  },
  {
    id: "information-we-collect",
    heading: "2. Information We Collect",
    blocks: [
      {
        type: "paragraph",
        text: "Depending on the features used, SugboGo processes different types of information.",
      },
      {
        type: "subheading",
        text: "Account and Profile Information",
      },
      {
        type: "paragraph",
        text: "When users register or manage an account, SugboGo processes information such as:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "First and last name",
          "Email address",
          "Password credentials",
          "Optional profile information",
          "Profile picture",
          "Account preferences and selected interests",
        ],
      },
      {
        type: "paragraph",
        text: "SugboGo also maintains account identifiers, verification status, roles, and security-related records.",
      },
      {
        type: "paragraph",
        text: "Passwords are handled through the application's authentication framework rather than stored as readable account passwords.",
      },
      {
        type: "subheading",
        text: "Authentication and Login Information",
      },
      {
        type: "paragraph",
        text: "SugboGo includes email-based authentication and integrations for Google and Facebook sign-in.",
      },
      {
        type: "paragraph",
        text: "Depending on the authentication method, the application may process provider account identifiers, names, email addresses, and profile-image references.",
      },
      {
        type: "paragraph",
        text: "Security-related login records may contain login timestamps, authentication methods, login outcomes, IP addresses, and classified client or platform information.",
      },
      {
        type: "subheading",
        text: "Location Information",
      },
      {
        type: "paragraph",
        text: "SugboGo requests foreground location permission for features such as business exploration and maps.",
      },
      {
        type: "paragraph",
        text: "Depending on the feature, location coordinates may be processed to help users discover nearby businesses, obtain routes, and access navigation-related services.",
      },
      {
        type: "paragraph",
        text: "Some mapping and routing operations involve external service providers.",
      },
      {
        type: "paragraph",
        text: "The repository audit did not identify a general background-location-tracking implementation.",
      },
      {
        type: "subheading",
        text: "Reviews, Vouches, and Saved Businesses",
      },
      {
        type: "paragraph",
        text: "When users interact with businesses, SugboGo may process:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Review text and photographs",
          "Review visibility preferences",
          "Specialty vouches",
          "Saved businesses and Pocket collections",
          "Associated account and business identifiers",
          "Relevant timestamps and interaction records",
        ],
      },
      {
        type: "paragraph",
        text: "Certain review information, including author identity details, may be visible to other authenticated application users.",
      },
      {
        type: "paragraph",
        text: "Pocket collections are handled through user-scoped application interfaces.",
      },
      {
        type: "subheading",
        text: "Interests and Application Activity",
      },
      {
        type: "paragraph",
        text: "SugboGo processes selected interests and certain business interactions to support personalized discovery and recommendations.",
      },
      {
        type: "paragraph",
        text: "These activities may include saved businesses, specialty vouches, business profile visits, and route-planning interactions.",
      },
      {
        type: "paragraph",
        text: "Some engagement records are maintained in backend analytics systems.",
      },
      {
        type: "subheading",
        text: "Business and Merchant Information",
      },
      {
        type: "paragraph",
        text: "Merchant-related features may process:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Business representative information",
          "Business contact details and locations",
          "Business descriptions and photographs",
          "Merchant application information",
          "Verification documents",
          "Application review and moderation records",
        ],
      },
      {
        type: "paragraph",
        text: "Certain approved business details may be displayed through the application. Merchant application information and verification documents are handled through separate workflows.",
      },
      {
        type: "subheading",
        text: "Device and Local Storage Information",
      },
      {
        type: "paragraph",
        text: "SugboGo generates an application installation identifier for certain contribution and abuse-prevention processes.",
      },
      {
        type: "paragraph",
        text: "The audited implementation did not establish collection of a hardware-specific device identifier.",
      },
      {
        type: "paragraph",
        text: "The application also uses device storage for authentication credentials, onboarding information, pending verification details, and certain offline business and journey information.",
      },
      {
        type: "paragraph",
        text: "Some offline information may remain on the device after logout.",
      },
    ],
  },
  {
    id: "how-we-use-information",
    heading: "3. How We Use Information",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo processes information to support activities such as:",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Creating and managing user accounts.",
          "Authenticating users and protecting account access.",
          "Allowing users to maintain profiles and interests.",
          "Providing business discovery, maps, and recommendations.",
          "Managing reviews, vouches, and saved businesses.",
          "Supporting merchant applications and business-management workflows.",
          "Detecting potential misuse and supporting moderation.",
          "Providing account-related email notifications.",
          "Maintaining application functionality and relevant engagement records.",
          "Supporting account-management and security features.",
        ],
      },
    ],
  },
  {
    id: "third-party-services",
    heading: "4. Third-Party Services",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo's audited implementation includes integrations with external services that support specific application features.",
      },
      {
        type: "paragraph",
        text: "These include:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Google and Facebook for authentication and identity-related functionality.",
          "Google Maps-related services for places, mapping, geocoding, and routing.",
          "Cloudinary for uploaded media and certain protected documents.",
          "Resend for transactional email delivery.",
          "OpenAI for automated review text and image moderation.",
          "Google Gemini for certain review analysis, summaries, and recommendation-related processing.",
        ],
      },
      {
        type: "paragraph",
        text: "The application also uses databases and supporting backend infrastructure.",
      },
      {
        type: "paragraph",
        text: "The information processed by a provider depends on the relevant feature and how the integration is configured.",
      },
      {
        type: "paragraph",
        text: "The team's final review must confirm which services are active in the intended release and the applicable external-processing disclosures.",
      },
    ],
  },
  {
    id: "reviews-moderation-and-ai-assisted-features",
    heading: "5. Reviews, Moderation, and AI-Assisted Features",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo includes automated systems that assist with review moderation, analysis, and summarization.",
      },
      {
        type: "paragraph",
        text: "Submitted review text and images may be processed by applicable moderation services.",
      },
      {
        type: "paragraph",
        text: "Certain review information may also be analyzed to generate summaries, keywords, or other insights.",
      },
      {
        type: "paragraph",
        text: "SugboGo maintains mechanisms for reporting specific review concerns and for merchant review disputes.",
      },
      {
        type: "paragraph",
        text: "These mechanisms are separate from a general customer-support system.",
      },
    ],
  },
  {
    id: "information-storage-and-security",
    heading: "6. Information Storage and Security",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo uses application authentication, access restrictions, and storage mechanisms to help protect information.",
      },
      {
        type: "paragraph",
        text: "The audited implementation includes:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Authenticated backend endpoints",
          "Account-specific access controls",
          "SecureStore for certain mobile authentication credentials",
          "Protected access to merchant verification documents",
          "Session revocation mechanisms",
        ],
      },
      {
        type: "paragraph",
        text: "Some offline information is stored locally on the user's device.",
      },
      {
        type: "paragraph",
        text: "These measures do not establish that every category of information is encrypted or protected against every possible security risk.",
      },
    ],
  },
  {
    id: "data-retention",
    heading: "7. Data Retention",
    blocks: [
      {
        type: "paragraph",
        text: "Information is stored through different application features and backend systems.",
      },
      {
        type: "paragraph",
        text: "The current implementation includes a 90-day login-history setting and a scheduled cleanup mechanism for eligible login records.",
      },
      {
        type: "paragraph",
        text: "This period does not apply to every category of personal information.",
      },
      {
        type: "paragraph",
        text: "Account records, contributions, merchant documents, moderation information, engagement records, offline copies, and backups may have different storage and cleanup behavior.",
      },
      {
        type: "paragraph",
        text: "Exact retention periods and deletion commitments require team confirmation before an official policy is published.",
      },
    ],
  },
  {
    id: "account-deactivation-and-data-deletion",
    heading: "8. Account Deactivation and Data Deletion",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo provides an account-deactivation feature for eligible authenticated users.",
      },
      {
        type: "paragraph",
        text: "Deactivation disables account access and revokes relevant sessions. It does not automatically erase all account information, contributions, or related business records.",
      },
      {
        type: "paragraph",
        text: "Some application features provide separate controls for editing or removing content, such as reviews and locally stored information.",
      },
      {
        type: "paragraph",
        text: "A complete self-service account-erasure or personal-data-export workflow was not identified in the repository audit.",
      },
      {
        type: "paragraph",
        text: "The official process for broader access, correction, deletion, or export requests requires team confirmation.",
      },
    ],
  },
  {
    id: "user-choices-and-controls",
    heading: "9. User Choices and Controls",
    blocks: [
      {
        type: "paragraph",
        text: "Depending on the feature and account state, SugboGo users can manage certain information through available controls.",
      },
      {
        type: "paragraph",
        text: "These include:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Editing profile information",
          "Updating selected interests",
          "Managing saved businesses and Pocket collections",
          "Managing reviews and vouches",
          "Reviewing login history",
          "Managing certain locally stored offline information",
          "Deactivating eligible accounts",
        ],
      },
      {
        type: "paragraph",
        text: "Users may also manage location permissions through supported device operating-system settings.",
      },
    ],
  },
  {
    id: "accessing-or-correcting-personal-information",
    heading: "10. Accessing or Correcting Personal Information",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo includes profile and account-management features through which users can view or update certain information.",
      },
      {
        type: "paragraph",
        text: "For privacy-related requests that cannot be completed through existing account controls, an official contact and verification procedure must be established by the responsible SugboGo team.",
      },
      {
        type: "paragraph",
        text: "The final policy must identify the approved procedure and contact channel.",
      },
    ],
  },
  {
    id: "changes-to-this-privacy-policy",
    heading: "11. Changes to This Privacy Policy",
    blocks: [
      {
        type: "paragraph",
        text: "This draft may be revised as SugboGo features, information-handling practices, and team decisions evolve.",
      },
      {
        type: "paragraph",
        text: "Before an official policy is published, the team must approve its effective date, versioning process, and approach for communicating material updates.",
      },
    ],
  },
  {
    id: "contact-information",
    heading: "12. Contact Information",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo is currently a student-developed capstone/thesis project.",
      },
      {
        type: "paragraph",
        text: "The team must confirm the responsible person or organization and official privacy contact details before publishing this policy.",
      },
      {
        type: "paragraph",
        text: "An official support email is being considered but has not yet been confirmed.",
      },
      {
        type: "paragraph",
        text: "Users should not treat example or proposed email addresses as active support channels.",
      },
    ],
  },
];
