export type SupportFaq = {
  readonly id: string;
  readonly question: string;
  readonly paragraphs: readonly string[];
  readonly steps: readonly string[];
  readonly explanation?: { readonly heading: string; readonly text: string };
  readonly goodToKnow?: readonly string[];
};

export type SupportFaqText = readonly (
  | string
  | { readonly text: string; readonly bold: true }
)[];

export type SupportFaqContent = Omit<
  SupportFaq,
  "paragraphs" | "steps" | "explanation" | "goodToKnow"
> & {
  readonly paragraphs: readonly SupportFaqText[];
  readonly steps: readonly SupportFaqText[];
  readonly explanation?: { readonly heading: string; readonly text: SupportFaqText };
  readonly goodToKnow?: readonly SupportFaqText[];
};

const bold = (text: string): SupportFaqText[number] => ({ text, bold: true });

/** Approved wording with explicit inline emphasis; no runtime phrase matching or replacement. */
export const SUPPORT_FAQ_CONTENT: readonly SupportFaqContent[] = [
  {
    id: "what-is-sugbogo",
    question: "What is SugboGo?",
    paragraphs: [
      ["SugboGo is an app that helps you discover and explore local businesses in Cebu."],
      ["You can search for businesses, view their specialties and reviews, share your support by vouching for their specialties, and save your favorite places in ", bold("My Pockets"), " for future visits."],
    ],
    steps: [],
  },
  {
    id: "find-businesses",
    question: "How can I register my business on SugboGo?",
    paragraphs: [
      ["Want to register your business on SugboGo? Follow these steps:"],
    ],
    steps: [
      ["Sign in to SugboGo and open your ", bold("Profile"), "."],
      ["Find the ", bold("Become a Merchant"), " section and tap ", bold("Open Merchant Portal"), ", then ", bold("Start Registration"), "."],
      ["Complete your ", bold("Business Identity"), ", including your business details, contact information, and specialties."],
      ["Set your ", bold("Business Location"), " by selecting your location on the map and confirming your address."],
      ["Set your ", bold("Operating Hours"), ", add ", bold("Business Photos"), ", and upload your ", bold("Verification Documents"), ". Tap ", bold("Save & Continue"), " after completing each section."],
      ["Review your information under ", bold("Review & Submit"), ", then tap ", bold("Submit Application"), " to send your registration for review."],
    ],
    explanation: {
      heading: "What is business registration for?",
      text: ["Business registration allows business owners to apply to list their businesses on SugboGo. Once approved, they can access ", bold("Merchant Mode"), " to manage their business."],
    },
    goodToKnow: [
      ["You need ", bold("at least one storefront photo"), " and ", bold("one business registration document"), " (such as a ", bold("DTI Certificate"), ", ", bold("SEC Certificate"), ", or ", bold("Mayor's Permit"), ")."],
      ["You can save your progress and continue later through ", bold("Continue Registration"), "."],
      ["Your application must be reviewed and approved before you can access ", bold("Merchant Mode"), ". You can check its status in the ", bold("Merchant Portal"), "."],
    ],
  },
  {
    id: "vouch-for-business",
    question: "How do I vouch for a business?",
    paragraphs: [
      ["Show your support for a business by vouching for its specialties. Follow these steps:"],
    ],
    steps: [
      ["Open SugboGo and find the business you want to support."],
      ["Tap the business to open its profile."],
      ["Scroll down to the ", bold("Specialties"), " section."],
      ["Tap the specialty you want to vouch for. Your vouch will be added to that specialty."],
    ],
    explanation: {
      heading: "What is a vouch for?",
      text: ["A vouch is your way of recommending a business for something it does well. By vouching for a specialty, you're showing other Explorers what you think the business is good at and helping them discover places worth checking out."],
    },
    goodToKnow: [
      ["You can tap the same specialty again to remove your vouch. You can also view and manage your vouches in ", bold("Profile → My Vouches"), "."],
    ],
  },
  {
    id: "my-pockets",
    question: "How do I save businesses to My Pockets?",
    paragraphs: [
      ["Save businesses you're interested in so you can easily find them again. Follow these steps:"],
    ],
    steps: [
      ["Open SugboGo and find the business you want to save."],
      ["Tap the business to open its profile."],
      ["Tap the ", bold("bookmark icon"), " to open your Pockets."],
      ["Select ", bold("Favorites"), " or another Pocket where you want to save the business."],
      ["Tap ", bold("Save changes"), " to save your selection."],
    ],
    explanation: {
      heading: "What is My Pockets for?",
      text: [bold("My Pockets"), " helps you keep your favorite businesses and places you want to visit in one place. You can create different Pockets to organize your saved businesses, making them easier to find whenever you need them."],
    },
    goodToKnow: [
      ["Want to create your own Pocket? Tap ", bold("Create a new Pocket"), ", enter a name, and create it before saving your selection."],
      ["You can view your saved businesses under ", bold("Profile → My Pockets"), ". To remove a business from a Pocket, open its bookmark options, deselect that Pocket, and tap ", bold("Save changes"), "."],
    ],
  },
  {
    id: "get-directions",
    question: "How can I get directions to a business?",
    paragraphs: [
      ["Planning to visit a business? SugboGo can help you find your way! Follow these steps:"],
    ],
    steps: [
      ["Open SugboGo and find the business you want to visit."],
      ["Tap the business to open its profile."],
      ["Scroll down to ", bold("Plan Your Visit"), "."],
      ["Tap ", bold("Road Route"), " and allow location access if prompted."],
      ["Review the suggested route, then tap ", bold("Continue in Google Maps"), " to navigate to the business."],
    ],
    explanation: {
      heading: "What is Plan Your Visit for?",
      text: [bold("Plan Your Visit"), " helps you explore ways to reach a business. You can preview a driving route, check available ", bold("Jeepney"), " route guidance, or choose a ride-booking option."],
    },
    goodToKnow: [
      ["You'll need an internet connection and a valid business location for route planning. Driving directions continue in ", bold("Google Maps"), ", while ride bookings are handled by external providers."],
    ],
  },
];

/** Flattens display segments without changing their words, punctuation or whitespace. */
export function getSupportFaqText(parts: SupportFaqText): string {
  return parts.map((part) => typeof part === "string" ? part : part.text).join("");
}

/** Preserves the plain-text interface used by the retained detail-page implementation. */
export const SUPPORT_FAQS: readonly SupportFaq[] = SUPPORT_FAQ_CONTENT.map((faq) => ({
  id: faq.id,
  question: faq.question,
  paragraphs: faq.paragraphs.map(getSupportFaqText),
  steps: faq.steps.map(getSupportFaqText),
  ...(faq.explanation ? {
    explanation: { heading: faq.explanation.heading, text: getSupportFaqText(faq.explanation.text) },
  } : {}),
  ...(faq.goodToKnow ? { goodToKnow: faq.goodToKnow.map(getSupportFaqText) } : {}),
}));

/** Resolves only a single exact identifier; malformed or unknown route values are unavailable. */
export function getSupportFaq(faqId: unknown): SupportFaq | undefined {
  return typeof faqId === "string"
    ? SUPPORT_FAQS.find((faq) => faq.id === faqId)
    : undefined;
}

/** Compatibility export for consumers requiring a single plain-text answer. */
export const SUPPORT_FAQ_DRAFT = SUPPORT_FAQS.map((faq) => ({
  id: faq.id,
  question: faq.question,
  answer: [
    ...faq.paragraphs,
    ...faq.steps.map((step, index) => `${index + 1}. ${step}`),
    ...(faq.explanation ? [faq.explanation.heading, faq.explanation.text] : []),
    ...(faq.goodToKnow ? ["Good to know", ...faq.goodToKnow] : []),
  ].join("\n\n"),
}));
