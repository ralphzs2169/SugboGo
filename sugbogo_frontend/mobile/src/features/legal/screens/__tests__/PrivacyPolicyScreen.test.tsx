import { render, within } from "@testing-library/react-native";

import PrivacyPolicyScreen from "../PrivacyPolicyScreen";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

const expectedHeadings = [
  "1. Introduction",
  "2. Information We Collect",
  "3. How We Use Information",
  "4. Third-Party Services",
  "5. Reviews, Moderation, and AI-Assisted Features",
  "6. Information Storage and Security",
  "7. Data Retention",
  "8. Account Deactivation and Data Deletion",
  "9. User Choices and Controls",
  "10. Accessing or Correcting Personal Information",
  "11. Changes to This Privacy Policy",
  "12. Contact Information",
];

const expectedSubheadings = [
  "Account and Profile Information",
  "Authentication and Login Information",
  "Location Information",
  "Reviews, Vouches, and Saved Businesses",
  "Interests and Application Activity",
  "Business and Merchant Information",
  "Device and Local Storage Information",
];

const representativeContent = [
  "SugboGo is a student-developed mobile application designed to help users discover local businesses, explore their specialties, share experiences, and support local establishments.",
  "Passwords are handled through the application's authentication framework rather than stored as readable account passwords.",
  "Security-related login records may contain login timestamps, authentication methods, login outcomes, IP addresses, and classified client or platform information.",
  "The repository audit did not identify a general background-location-tracking implementation.",
  "Pocket collections are handled through user-scoped application interfaces.",
  "Some engagement records are maintained in backend analytics systems.",
  "Verification documents",
  "The audited implementation did not establish collection of a hardware-specific device identifier.",
  "Supporting account-management and security features.",
  "OpenAI for automated review text and image moderation.",
  "Google Gemini for certain review analysis, summaries, and recommendation-related processing.",
  "These mechanisms are separate from a general customer-support system.",
  "These measures do not establish that every category of information is encrypted or protected against every possible security risk.",
  "This period does not apply to every category of personal information.",
  "Deactivation disables account access and revokes relevant sessions. It does not automatically erase all account information, contributions, or related business records.",
  "Users may also manage location permissions through supported device operating-system settings.",
  "The final policy must identify the approved procedure and contact channel.",
  "Before an official policy is published, the team must approve its effective date, versioning process, and approach for communicating material updates.",
  "An official support email is being considered but has not yet been confirmed.",
];

const draftLabel = "Draft — Pending Team Approval";
const placeholder =
  "Privacy Policy content is under review and is not yet available.";
const originalDevelopmentDescriptor = Object.getOwnPropertyDescriptor(
  globalThis,
  "__DEV__",
);

/** Sets the runtime flag without depending on its presence in TypeScript's global keys. */
function setDevelopmentMode(value: boolean) {
  Object.defineProperty(globalThis, "__DEV__", {
    configurable: true,
    writable: true,
    value,
  });
}

describe("Privacy Policy draft", () => {
  beforeEach(() => {
    setDevelopmentMode(true);
  });

  afterEach(() => {
    if (originalDevelopmentDescriptor) {
      Object.defineProperty(
        globalThis,
        "__DEV__",
        originalDevelopmentDescriptor,
      );
    } else {
      Reflect.deleteProperty(globalThis, "__DEV__");
    }
  });

  it("renders all twelve accessible main headings in the supplied order", async () => {
    const screen = await render(<PrivacyPolicyScreen />);

    const headings = screen.getAllByRole("header", { name: /^\d+\. / });
    expect(headings.map((heading) => heading.props.children)).toEqual(
      expectedHeadings,
    );
    expect(screen.queryByText(placeholder)).toBeNull();
  });

  it("renders supplied subheadings and representative paragraphs and list items", async () => {
    const screen = await render(<PrivacyPolicyScreen />);

    for (const heading of expectedSubheadings) {
      expect(screen.getByRole("header", { name: heading })).toBeTruthy();
    }
    for (const text of representativeContent) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getByText("First and last name")).toBeTruthy();
    expect(
      screen.getByLabelText("1. Creating and managing user accounts."),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "10. Supporting account-management and security features.",
      ),
    ).toBeTruthy();
  });

  it("keeps the draft notice outside the scrolling document", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    const document = within(screen.getByTestId("privacy-policy-scroll"));

    expect(screen.getByText(draftLabel)).toBeTruthy();
    expect(document.queryByText(draftLabel)).toBeNull();
    expect(
      document.getByRole("header", { name: "12. Contact Information" }),
    ).toBeTruthy();
  });

  it("does not render implementation instructions or duplicate the route title", async () => {
    const screen = await render(<PrivacyPolicyScreen />);

    expect(
      screen.queryByText(
        /# TASK|PHASE [1-7]|PrivacyPolicyScreen\.tsx|privacyPolicyDraft\.ts|__DEV__|Do not commit|Wait for explicit review/i,
      ),
    ).toBeNull();
    expect(
      screen.queryByRole("header", { name: "Privacy Policy" }),
    ).toBeNull();
  });

  it("retains the placeholder and renders none of the draft in production", async () => {
    setDevelopmentMode(false);
    const screen = await render(<PrivacyPolicyScreen />);

    expect(screen.getByText(placeholder)).toBeTruthy();
    expect(screen.queryByText(draftLabel)).toBeNull();
    expect(screen.queryAllByRole("header")).toHaveLength(0);
    for (const text of [
      ...expectedHeadings,
      ...expectedSubheadings,
      ...representativeContent,
    ]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });

  it("removes the draft when rendering switches to production mode", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    expect(screen.getByText(draftLabel)).toBeTruthy();

    setDevelopmentMode(false);
    await screen.rerender(<PrivacyPolicyScreen />);

    expect(screen.getByText(placeholder)).toBeTruthy();
    expect(screen.queryByText(draftLabel)).toBeNull();
    expect(screen.queryAllByRole("header")).toHaveLength(0);
    for (const text of representativeContent) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });
});
