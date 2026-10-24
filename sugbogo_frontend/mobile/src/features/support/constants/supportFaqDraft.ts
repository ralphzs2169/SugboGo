export type SupportFaq = {
  readonly id: string;
  readonly question: string;
  readonly paragraphs: readonly string[];
  readonly steps: readonly string[];
  readonly explanation?: { readonly heading: string; readonly text: string };
  readonly goodToKnow?: readonly string[];
};

/** Developer-approved FAQ wording shared by the detail pages and existing accordion. */
export const SUPPORT_FAQS: readonly SupportFaq[] = [
  {
    id: "what-is-sugbogo",
    question: "What is SugboGo?",
    paragraphs: [
      "SugboGo is an app that helps you discover and explore local businesses in Cebu.",
      "You can search for businesses, view their specialties and reviews, share your support by vouching for their specialties, and save your favorite places in My Pockets for future visits.",
    ],
    steps: [],
  },
  {
    id: "find-businesses",
    question: "How can I find businesses on SugboGo?",
    paragraphs: ["Finding local businesses is easy! Just follow these steps:"],
    steps: [
      "Open the Explore tab in SugboGo.",
      "Tap the Search bar and enter the name of a business or what you're looking for.",
      "Use Filters if you want to narrow down your results.",
      "Tap a business card to view its profile, specialties, and other details.",
    ],
    explanation: {
      heading: "Another way",
      text: "You can also open the Map tab to discover businesses by location. Select a business and tap View Business to see its profile.",
    },
  },
  {
    id: "vouch-for-business",
    question: "How do I vouch for a business?",
    paragraphs: ["Show your support for a business by vouching for its specialties. Follow these steps:"],
    steps: [
      "Open SugboGo and find the business you want to support.",
      "Tap the business to open its profile.",
      "Scroll down to the Specialties section.",
      "Tap the specialty you want to vouch for. Your vouch will be added to that specialty.",
    ],
    explanation: {
      heading: "What is a vouch for?",
      text: "A vouch is your way of recommending a business for something it does well. By vouching for a specialty, you're showing other Explorers what you think the business is good at and helping them discover places worth checking out.",
    },
    goodToKnow: [
      "You can tap the same specialty again to remove your vouch. You can also view and manage your vouches in Profile → My Vouches.",
    ],
  },
  {
    id: "my-pockets",
    question: "How do I save businesses to My Pockets?",
    paragraphs: ["Save businesses you're interested in so you can easily find them again. Follow these steps:"],
    steps: [
      "Open SugboGo and find the business you want to save.",
      "Tap the business to open its profile.",
      "Tap the bookmark icon to open your Pockets.",
      "Select Favorites or another Pocket where you want to save the business.",
      "Tap Save changes to save your selection.",
    ],
    explanation: {
      heading: "What is My Pockets for?",
      text: "My Pockets helps you keep your favorite businesses and places you want to visit in one place. You can create different Pockets to organize your saved businesses, making them easier to find whenever you need them.",
    },
    goodToKnow: [
      "Want to create your own Pocket? Tap Create a new Pocket, enter a name, and create it before saving your selection.",
      "You can view your saved businesses under Profile → My Pockets. To remove a business from a Pocket, open its bookmark options, deselect that Pocket, and tap Save changes.",
    ],
  },
  {
    id: "get-directions",
    question: "How can I get directions to a business?",
    paragraphs: ["Planning to visit a business? SugboGo can help you find your way! Follow these steps:"],
    steps: [
      "Open SugboGo and find the business you want to visit.",
      "Tap the business to open its profile.",
      "Scroll down to Plan Your Visit.",
      "Tap Road Route and allow location access if prompted.",
      "Review the suggested route, then tap Continue in Google Maps to navigate to the business.",
    ],
    explanation: {
      heading: "What is Plan Your Visit for?",
      text: "Plan Your Visit helps you explore ways to reach a business. You can preview a driving route, check available Jeepney route guidance, or choose a ride-booking option.",
    },
    goodToKnow: [
      "You'll need an internet connection and a valid business location for route planning. Driving directions continue in Google Maps, while ride bookings are handled by external providers.",
    ],
  },
];

/** Resolves only a single exact identifier; malformed or unknown route values are unavailable. */
export function getSupportFaq(faqId: unknown): SupportFaq | undefined {
  return typeof faqId === "string"
    ? SUPPORT_FAQS.find((faq) => faq.id === faqId)
    : undefined;
}

/** Compatibility export: the unchanged accordion still expects one plain-text answer. */
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
