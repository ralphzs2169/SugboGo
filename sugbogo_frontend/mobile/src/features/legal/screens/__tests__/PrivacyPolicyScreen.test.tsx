import { fireEvent, render, within } from "@testing-library/react-native";
import { ScrollView } from "react-native";

import PrivacyPolicyScreen from "../PrivacyPolicyScreen";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

const mockScrollTo = jest.spyOn(ScrollView.prototype, "scrollTo");

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="policy-icon" {...props} />;
  },
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
  "We ask permission to use your location while you use the app to find nearby businesses, show maps, plan routes, and provide navigation.",
  "Some map and route features may share location information with external map services to provide these features.",
  "SugboGo is a student-developed mobile app that helps you discover local businesses, explore their specialties, share experiences, and support them.",
  "We aim to explain clearly how SugboGo collects, uses, stores, and shares your personal information.",
  "This draft explains what personal information SugboGo handles, why it is used, and the choices available to you.",
  "We also keep account IDs, whether your account is verified, your account type, and security records. Our sign-in system checks passwords without storing readable copies.",
  "Security records may include the sign-in attempt time, method, whether it succeeded, IP address, and app, browser, or operating system type.",
  "During our code review, we did not find a feature designed to track your location while the app is running in the background.",
  "Your Pocket collections are linked to your signed-in account and managed through the app's Pocket features.",
  "We use selected interests and business interactions to personalize discovery and recommendations. These may include saved businesses, specialty vouches, profile visits, and route planning. Some interactions linked to accounts are stored to measure app activity.",
  "Verification documents",
  "The code review did not confirm collection of an ID tied to the device's hardware.",
  "Support account management and security features.",
  "OpenAI for automatically checking review text and photos for potentially unsuitable content.",
  "Google Gemini for some review analysis, summaries, and merchant recommendations.",
  "You can report concerns about a review, and merchants can dispute reviews. These reporting and dispute features are separate from general customer support.",
  "These measures do not mean that all information is encrypted or protected from every security risk.",
  "Login history has a 90-day setting, measured from when each sign-in record is created. An automated cleanup task is configured to delete older login records, but its operation in the final release still needs confirmation. This period does not apply to all personal information.",
  "Deactivation blocks sign-in and ends existing sign-in sessions. It does not automatically delete your account information, contributions, or related business records.",
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
    mockScrollTo.mockClear();
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
      screen.getByLabelText("1. Create and manage accounts."),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(
        "10. Support account management and security features.",
      ),
    ).toBeTruthy();
  });

  it("pairs each main section with its approved decorative icon", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    const document = within(screen.getByTestId("privacy-policy-scroll"));
    const expectedIcons = {
      introduction: "information-outline",
      "information-we-collect": "account-details-outline",
      "how-we-use-information": "clipboard-list-outline",
      "third-party-services": "share-variant-outline",
      "reviews-moderation-and-ai-assisted-features": "comment-check-outline",
      "information-storage-and-security": "shield-lock-outline",
      "data-retention": "clock-outline",
      "account-deactivation-and-data-deletion": "account-off-outline",
      "user-choices-and-controls": "tune-variant",
      "accessing-or-correcting-personal-information": "account-edit-outline",
      "changes-to-this-privacy-policy": "file-document-edit-outline",
      "contact-information": "email-outline",
    };
    expect(document.getAllByTestId("policy-icon")).toHaveLength(12);
    for (const [id, name] of Object.entries(expectedIcons)) {
      const section = within(screen.getByTestId(`privacy-policy-section-${id}`));
      const icon = section.getByTestId("policy-icon");
      expect(icon.props.name).toBe(name);
      expect(icon.props.accessible).toBe(false);
      expect(icon.props.importantForAccessibility).toBe("no");
      expect(icon.props.onPress).toBeUndefined();
    }
  });

  it("starts closed at Introduction, without the draft banner", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    const document = within(screen.getByTestId("privacy-policy-scroll"));

    const trigger = screen.getByRole("button", {
      name: "Choose a Privacy Policy section",
    });
    expect(trigger.props.accessibilityState).toEqual({ expanded: false });
    expect(trigger.props.accessibilityValue.text).toBe(expectedHeadings[0]);
    expect(
      within(trigger).getByText(expectedHeadings[0]).props.className,
    ).toContain("text-brand");
    expect(screen.queryByTestId("privacy-policy-sections")).toBeNull();
    expect(screen.queryByText(draftLabel)).toBeNull();
    expect(
      document.getByRole("header", { name: "12. Contact Information" }),
    ).toBeTruthy();
  });

  it("toggles the twelve ordered navigation choices without resetting the document", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    const trigger = screen.getByRole("button", {
      name: "Choose a Privacy Policy section",
    });

    await fireEvent.press(trigger);
    const menu = within(screen.getByTestId("privacy-policy-sections"));
    expect(
      menu.getAllByRole("button").map((item) => item.props.accessibilityLabel),
    ).toEqual(expectedHeadings);
    expect(menu.queryByTestId("policy-icon")).toBeNull();
    expect(
      menu.getByRole("button", { name: expectedHeadings[0] }).props.accessibilityState,
    ).toEqual({ selected: true });
    expect(
      within(screen.getByTestId("privacy-policy-scroll")).getAllByRole("header", {
        name: /^\d+\. /,
      }),
    ).toHaveLength(12);
    await fireEvent.press(trigger);
    expect(screen.queryByTestId("privacy-policy-sections")).toBeNull();
    expect(mockScrollTo).not.toHaveBeenCalled();
    // No scrollEnabled=false or responder handler intercepts ordinary document gestures.
    expect(
      screen.getByTestId("privacy-policy-scroll").props.scrollEnabled,
    ).not.toBe(false);
  });

  it.each([
    ["introduction", "1. Introduction", 24],
    ["data-retention", "7. Data Retention", 2400],
    ["contact-information", "12. Contact Information", 4800],
  ])("jumps to measured %s, closes the menu and updates its label", async (id, heading, y) => {
    const screen = await render(<PrivacyPolicyScreen />);
    await fireEvent(screen.getByTestId(`privacy-policy-section-${id}`), "layout", {
      nativeEvent: { layout: { x: 0, y, width: 320, height: 200 } },
    });
    const trigger = screen.getByRole("button", {
      name: "Choose a Privacy Policy section",
    });
    await fireEvent.press(trigger);
    await fireEvent.press(screen.getByRole("button", { name: heading }));

    expect(mockScrollTo).toHaveBeenLastCalledWith({ y, animated: true });
    expect(screen.queryByTestId("privacy-policy-sections")).toBeNull();
    expect(trigger.props.accessibilityValue.text).toBe(heading);
    expect(within(trigger).getByText(heading).props.className).toContain(
      "text-brand",
    );
    expect(
      within(screen.getByTestId("privacy-policy-scroll"))
        .getAllByRole("header", { name: /^\d+\. / })
        .map((item) => item.props.children),
    ).toEqual(expectedHeadings);
    await fireEvent.press(trigger);
    const selectedItem = screen.getByRole("button", { name: heading });
    expect(selectedItem.props.accessibilityState).toEqual({ selected: true });
    expect(within(selectedItem).getByText(heading).props.className).toContain(
      "text-brand",
    );
  });

  it("defers a jump until layout and uses updated positions after text reflows", async () => {
    const screen = await render(<PrivacyPolicyScreen />);
    const trigger = screen.getByRole("button", {
      name: "Choose a Privacy Policy section",
    });
    await fireEvent.press(trigger);
    await fireEvent.press(screen.getByRole("button", { name: "7. Data Retention" }));
    expect(mockScrollTo).not.toHaveBeenCalled();

    const section = screen.getByTestId("privacy-policy-section-data-retention");
    await fireEvent(section, "layout", {
      nativeEvent: { layout: { x: 0, y: 2600, width: 320, height: 300 } },
    });
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 2600, animated: true });
    await fireEvent(section, "layout", {
      nativeEvent: { layout: { x: 0, y: 3400, width: 280, height: 400 } },
    });
    await fireEvent.press(trigger);
    await fireEvent.press(screen.getByRole("button", { name: "7. Data Retention" }));
    expect(mockScrollTo).toHaveBeenLastCalledWith({ y: 3400, animated: true });
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
    expect(screen.queryByTestId("policy-icon")).toBeNull();
    expect(screen.queryByText(draftLabel)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
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
    expect(screen.getByRole("header", { name: expectedHeadings[0] })).toBeTruthy();

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
