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
        text: "SugboGo is a student-developed mobile app that helps you discover local businesses, explore their specialties, share experiences, and support them.",
      },
      {
        type: "paragraph",
        text: "We aim to explain clearly how SugboGo collects, uses, stores, and shares your personal information.",
      },
      {
        type: "paragraph",
        text: "This draft explains what personal information SugboGo handles, why it is used, and the choices available to you.",
      },
    ],
  },
  {
    id: "information-we-collect",
    heading: "2. Information We Collect",
    blocks: [
      {
        type: "paragraph",
        text: "What SugboGo collects and uses depends on the features you use.",
      },
      {
        type: "subheading",
        text: "Account and Profile Information",
      },
      {
        type: "paragraph",
        text: "When you register or manage your account, we use information such as:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "First and last name",
          "Email address",
          "Password information",
          "Optional profile details",
          "Profile picture",
          "Account preferences and selected interests",
        ],
      },
      {
        type: "paragraph",
        text: "We also keep account IDs, whether your account is verified, your account type, and security records. Our sign-in system checks passwords without storing readable copies.",
      },
      {
        type: "subheading",
        text: "Authentication and Login Information",
      },
      {
        type: "paragraph",
        text: "You can sign in with email, Google, or Facebook. Depending on the method, we may receive your provider account ID, name, email address, and profile-picture link.",
      },
      {
        type: "paragraph",
        text: "Security records may include the sign-in attempt time, method, whether it succeeded, IP address, and app, browser, or operating system type.",
      },
      {
        type: "subheading",
        text: "Location Information",
      },
      {
        type: "paragraph",
        text: "We ask permission to use your location while you use the app to find nearby businesses, show maps, plan routes, and provide navigation.",
      },
      {
        type: "paragraph",
        text: "Some map and route features may share location information with external map services to provide these features.",
      },
      {
        type: "paragraph",
        text: "During our code review, we did not find a feature designed to track your location while the app is running in the background.",
      },
      {
        type: "subheading",
        text: "Reviews, Vouches, and Saved Businesses",
      },
      {
        type: "paragraph",
        text: "When you interact with businesses, we may use:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Review text and photos",
          "Your choice about showing a review in the Community feed",
          "Specialty vouches",
          "Saved businesses and Pocket collections",
          "Account and business IDs linked to these activities",
          "Activity times and interaction records",
        ],
      },
      {
        type: "paragraph",
        text: "Other signed-in users may see published review information, including the author's name and profile details.",
      },
      {
        type: "paragraph",
        text: "Your Pocket collections are linked to your signed-in account and managed through the app's Pocket features.",
      },
      {
        type: "subheading",
        text: "Interests and Application Activity",
      },
      {
        type: "paragraph",
        text: "We use selected interests and business interactions to personalize discovery and recommendations. These may include saved businesses, specialty vouches, profile visits, and route planning. Some interactions linked to accounts are stored to measure app activity.",
      },
      {
        type: "subheading",
        text: "Business and Merchant Information",
      },
      {
        type: "paragraph",
        text: "Merchant features may use:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Business representative information",
          "Business contact details and locations",
          "Business descriptions and photos",
          "Merchant application information",
          "Verification documents",
          "Application review and moderation records",
        ],
      },
      {
        type: "paragraph",
        text: "Some approved business details may appear in the app. Applications and verification documents are handled separately through registration and review.",
      },
      {
        type: "subheading",
        text: "Device and Local Storage Information",
      },
      {
        type: "paragraph",
        text: "We create an app installation ID to help check some contributions and identify possible misuse.",
      },
      {
        type: "paragraph",
        text: "The code review did not confirm collection of an ID tied to the device's hardware.",
      },
      {
        type: "paragraph",
        text: "Your device stores sign-in details, first-time setup information, pending verification details, and some offline business and journey information.",
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
        text: "For example, we use information to:",
      },
      {
        type: "list",
        ordered: true,
        items: [
          "Create and manage accounts.",
          "Check sign-ins and help protect account access.",
          "Manage your profile and interests.",
          "Provide business discovery, maps, and recommendations.",
          "Manage reviews, vouches, and saved businesses.",
          "Handle merchant applications and help merchants manage their businesses.",
          "Detect possible misuse and review reported or potentially unsuitable content.",
          "Send account-related emails.",
          "Keep the app working and record relevant activity.",
          "Support account management and security features.",
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
