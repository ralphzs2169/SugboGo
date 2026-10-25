import { fireEvent, render, within } from "@testing-library/react-native";
import { Linking } from "react-native";
import Toast from "react-native-toast-message";

import { SUPPORT_FAQS } from "../../constants/supportFaqDraft";
import ContactSupportScreen from "../ContactSupportScreen";

// Expo's first native render may include cold module transforms.
jest.setTimeout(15_000);

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  router: { push: mockPush, replace: mockReplace },
}));

jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));
jest.mock("expo-image", () => ({
  Image: (props: Record<string, unknown>) => {
    const { View } = jest.requireActual("react-native");
    return <View {...props} />;
  },
}));
jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: (props: { name: string }) => {
    const { View } = jest.requireActual("react-native");
    return <View testID="faq-chevron" accessibilityLabel={props.name} />;
  },
}));

const expectedEmphasis: Record<string, readonly string[]> = {
  "what-is-sugbogo": ["My Pockets"],
  "find-businesses": ["Profile", "Become a Merchant", "Open Merchant Portal", "Start Registration", "Business Identity", "Business Location", "Operating Hours", "Business Photos", "Verification Documents", "Save & Continue", "Review & Submit", "Submit Application", "Merchant Mode", "Continue Registration", "at least one storefront photo", "one business registration document", "DTI Certificate", "SEC Certificate", "Mayor's Permit", "Merchant Portal"],
  "vouch-for-business": ["Specialties", "Profile → My Vouches"],
  "my-pockets": ["Favorites", "Save changes", "My Pockets", "Create a new Pocket", "Profile → My Pockets"],
  "get-directions": ["Plan Your Visit", "Road Route", "Continue in Google Maps", "Jeepney", "Google Maps"],
};

describe("Contact Support Help Center", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserves the mascot and greeting, with five initially collapsed FAQ buttons", async () => {
    const screen = await render(<ContactSupportScreen />);
    const mascot = screen.getByTestId("support-mascot");
    expect(mascot.props.source).toEqual(require("@/shared/assets/mascot/mascot-greeting.webp"));
    expect(mascot.props.contentFit).toBe("contain");
    expect(screen.getByRole("header", { name: "Hi there, Explorer!" })).toBeTruthy();
    expect(screen.getByText("How can we help you today?")).toBeTruthy();
    expect(screen.getByTestId("support-scroll").props.scrollEnabled).not.toBe(false);
    const rows = screen.getAllByRole("button", { expanded: false });
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.props.accessibilityLabel)).toEqual(
      SUPPORT_FAQS.map((faq) => faq.question),
    );
    expect(screen.queryByTestId("support-faq-answer")).toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByText("Submission coming soon")).toBeNull();
    expect(screen.queryByText("Your text is not submitted or saved.")).toBeNull();
    for (const row of rows) {
      expect(within(row).getByTestId("faq-chevron").props.accessibilityLabel).toBe("chevron-down");
    }
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });

  it("shows only an informational notice without sending, logging or clearing concern text", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const infoSpy = jest.spyOn(console, "info").mockImplementation(() => undefined);
    const linkSpy = jest.spyOn(Linking, "openURL");
    try {
      const screen = await render(<ContactSupportScreen />);
      const input = screen.getByLabelText("Tell us your concern");
      expect(input.props.multiline).toBe(true);
      expect(input.props.numberOfLines).toBe(4);
      expect(input.props.placeholder).toBe("Tell us about your concern or question...");
      expect(screen.queryByText("Tell us your concern")).toBeNull();
      await fireEvent.changeText(input, "Private concern\nsecond line");
      const submit = screen.getByRole("button", { name: "Submit" });
      expect(submit).toBeEnabled();
      await fireEvent.press(submit);
      expect(Toast.show).toHaveBeenCalledTimes(1);
      expect(Toast.show).toHaveBeenCalledWith({
        type: "info",
        text1: "Support submissions aren't available yet. Your message hasn't been sent.",
      });
      expect(input.props.value).toBe("Private concern\nsecond line");
      expect(submit.props.accessibilityState).toEqual({ disabled: false, busy: false });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
      expect(linkSpy).not.toHaveBeenCalled();
      expect(mockPush).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      await screen.unmount();
      const reopened = await render(<ContactSupportScreen />);
      expect(reopened.getByLabelText("Tell us your concern").props.value).toBe("");
    } finally {
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      infoSpy.mockRestore();
      linkSpy.mockRestore();
    }
  });

  it.each(SUPPORT_FAQS)("opens and closes $question inline, preserving words and numbered steps", async (faq) => {
    const screen = await render(<ContactSupportScreen />);
    const row = screen.getByRole("button", { name: faq.question });
    await fireEvent.press(row);
    expect(row.props.accessibilityState).toEqual({ expanded: true });
    expect(within(row).getByTestId("faq-chevron").props.accessibilityLabel).toBe("chevron-up");
    const answer = within(screen.getByTestId("support-faq-answer"));
    for (const paragraph of faq.paragraphs) expect(answer.getByText(paragraph)).toBeTruthy();
    if (faq.steps.length) {
      expect(answer.getAllByLabelText(/^\d+\. /).map((step) => step.props.accessibilityLabel)).toEqual(
        faq.steps.map((step, index) => `${index + 1}. ${step}`),
      );
    } else expect(answer.queryByTestId("support-faq-steps")).toBeNull();
    if (faq.explanation) {
      expect(answer.getByRole("header", { name: faq.explanation.heading })).toBeTruthy();
      expect(answer.getByText(faq.explanation.text)).toBeTruthy();
    }
    if (faq.goodToKnow) {
      expect(answer.getByRole("header", { name: "Good to know" })).toBeTruthy();
      for (const paragraph of faq.goodToKnow) expect(answer.getByText(paragraph)).toBeTruthy();
    }
    for (const phrase of expectedEmphasis[faq.id]) {
      for (const span of answer.getAllByText(phrase)) {
        expect(span.props.className).toContain("font-nunito-bold");
      }
    }
    expect(mockPush).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await fireEvent.press(row);
    expect(screen.queryByTestId("support-faq-answer")).toBeNull();
    expect(row.props.accessibilityState).toEqual({ expanded: false });
  });

  it("keeps only one answer open while preserving concern input", async () => {
    const screen = await render(<ContactSupportScreen />);
    const input = screen.getByLabelText("Tell us your concern");
    await fireEvent.changeText(input, "Keep this temporary text");
    for (const faq of SUPPORT_FAQS) {
      await fireEvent.press(screen.getByRole("button", { name: faq.question }));
      expect(screen.getAllByTestId("support-faq-answer")).toHaveLength(1);
      expect(screen.getAllByRole("button", { expanded: true })).toHaveLength(1);
      for (const candidate of SUPPORT_FAQS) {
        if (candidate.id === faq.id) expect(screen.getByText(candidate.paragraphs[0])).toBeTruthy();
        else expect(screen.queryByText(candidate.paragraphs[0])).toBeNull();
      }
    }
    expect(input.props.value).toBe("Keep this temporary text");
    expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled();
  });
});
