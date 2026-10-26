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
        text: "Some features may share information with external services. The reviewed code includes:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Google and Facebook for sign-in and linked account information.",
          "Google Maps for finding places, showing maps, matching locations with addresses, and planning routes.",
          "Cloudinary for uploaded media and some documents with restricted access.",
          "Resend for account-related emails.",
          "OpenAI for automatically checking review text and photos for potentially unsuitable content.",
          "Google Gemini for some review analysis, summaries, and merchant recommendations.",
        ],
      },
      {
        type: "paragraph",
        text: "Databases and servers also store information and run app services.",
      },
      {
        type: "paragraph",
        text: "What providers receive or use depends on the feature and service settings. Before release, the team must confirm active services and how they handle information.",
      },
    ],
  },
  {
    id: "reviews-moderation-and-ai-assisted-features",
    heading: "5. Reviews, Moderation, and AI-Assisted Features",
    blocks: [
      {
        type: "paragraph",
        text: "We use automated tools to help check and analyze reviews. Review text and photos you submit may be sent to external services to check for potentially unsuitable content.",
      },
      {
        type: "paragraph",
        text: "Review analysis may produce summaries, keywords, and other insights.",
      },
      {
        type: "paragraph",
        text: "You can report concerns about a review, and merchants can dispute reviews. These reporting and dispute features are separate from general customer support.",
      },
    ],
  },
  {
    id: "information-storage-and-security",
    heading: "6. Information Storage and Security",
    blocks: [
      {
        type: "paragraph",
        text: "SugboGo uses sign-in checks, access restrictions, and storage features to help protect information. The reviewed code includes:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Sign-in checks for protected app services",
          "Access checks for information linked to an account",
          "Storing some sign-in information using your device's secure storage",
          "Restricted access to merchant verification documents",
          "Ways to end existing sign-in sessions",
        ],
      },
      {
        type: "paragraph",
        text: "Some offline information is stored on your device.",
      },
      {
        type: "paragraph",
        text: "These measures do not mean that all information is encrypted or protected from every security risk.",
      },
    ],
  },
  {
    id: "data-retention",
    heading: "7. Data Retention",
    blocks: [
      {
        type: "paragraph",
        text: "Different app features and server systems store information.",
      },
      {
        type: "paragraph",
        text: "Login history has a 90-day setting, measured from when each sign-in record is created. An automated cleanup task is configured to delete older login records, but its operation in the final release still needs confirmation. This period does not apply to all personal information.",
      },
      {
        type: "paragraph",
        text: "Account records, contributions, merchant documents, moderation records, app activity, offline copies, and backups may be kept and removed differently.",
      },
      {
        type: "paragraph",
        text: "Before publishing an official policy, the team must confirm how long each type of information is kept and what will be deleted.",
      },
    ],
  },
  {
    id: "account-deactivation-and-data-deletion",
    heading: "8. Account Deactivation and Data Deletion",
    blocks: [
      {
        type: "paragraph",
        text: "If your account meets the requirements, you can deactivate it from Account Settings while signed in.",
      },
      {
        type: "paragraph",
        text: "Deactivation blocks sign-in and ends existing sign-in sessions. It does not automatically delete your account information, contributions, or related business records.",
      },
      {
        type: "paragraph",
        text: "Some features let you edit or remove content, such as reviews. Certain information stored on your device can also be removed separately.",
      },
      {
        type: "paragraph",
        text: "Our code review did not find a complete way for users to permanently delete their account data or export their personal information themselves.",
      },
      {
        type: "paragraph",
        text: "The team must confirm the official process for requests to access, correct, delete, or export personal information.",
      },
    ],
  },
  {
    id: "user-choices-and-controls",
    heading: "9. User Choices and Controls",
    blocks: [
      {
        type: "paragraph",
        text: "Available controls depend on the feature, your account status, and your role.",
      },
      {
        type: "paragraph",
        text: "These include:",
      },
      {
        type: "list",
        ordered: false,
        items: [
          "Editing your profile information",
          "Updating your selected interests",
          "Managing saved businesses and Pocket collections",
          "Managing your reviews and vouches",
          "Viewing your login history",
          "Managing certain offline information stored on your device",
          "Deactivating your account if you're eligible",
        ],
      },
      {
        type: "paragraph",
        text: "You can also manage location permissions in your device settings, where supported.",
      },
    ],
  },
  {
    id: "accessing-or-correcting-personal-information",
    heading: "10. Accessing or Correcting Personal Information",
    blocks: [
      {
        type: "paragraph",
        text: "You can view or update some personal information through SugboGo's profile and account features.",
      },
      {
        type: "paragraph",
        text: "For privacy requests that the app cannot handle, the SugboGo team still needs to establish an official contact method and a way to verify requests.",
      },
      {
        type: "paragraph",
        text: "The final policy must explain the approved process and how to contact the team.",
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
