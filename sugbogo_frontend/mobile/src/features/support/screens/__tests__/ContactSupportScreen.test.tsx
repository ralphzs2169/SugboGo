import { fireEvent, render, within } from "@testing-library/react-native";

import { SUPPORT_FAQS } from "../../constants/supportFaqDraft";
import ContactSupportScreen from "../ContactSupportScreen";

const mockPush = jest.fn();
const mockReplace = jest.fn();

const approvedAnswerText = SUPPORT_FAQS.flatMap((faq) => [
  ...faq.paragraphs,
  ...faq.steps,
  ...(faq.explanation ? [faq.explanation.text] : []),
  ...(faq.goodToKnow ?? []),
]);

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

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

describe("Contact Support Help Center", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the unchanged greeting, scrollable content and exactly five visible FAQ links", async () => {
    const screen = await render(<ContactSupportScreen />);
    const mascot = screen.getByTestId("support-mascot");
    expect(mascot.props.source).toEqual(
      require("@/shared/assets/mascot/mascot-greeting.webp"),
    );
    expect(mascot.props.contentFit).toBe("contain");
    expect(screen.getByRole("header", { name: "Hi there, Explorer!" })).toBeTruthy();
    expect(screen.getByText("How can we help you today?")).toBeTruthy();
    expect(screen.queryByText("Draft answers — pending developer review.")).toBeNull();
    expect(screen.getByTestId("support-scroll").props.scrollEnabled).not.toBe(false);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(links.map((link) => link.props.accessibilityLabel)).toEqual(
      SUPPORT_FAQS.map((faq) => faq.question),
    );
    expect(SUPPORT_FAQS.map((faq) => faq.id)).toEqual([
      "what-is-sugbogo", "find-businesses", "vouch-for-business", "my-pockets", "get-directions",
    ]);
    for (const link of links) {
      expect(link.props.accessibilityState?.expanded).toBeUndefined();
      expect(within(link).getByTestId("faq-chevron").props.accessibilityLabel).toBe("chevron-right");
    }
    for (const text of approvedAnswerText) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(screen.queryByRole("header", { name: "Contact Support" })).toBeNull();
  });

  it("keeps multiline edits temporary and Submit disabled without sending a request", async () => {
    const fetchSpy = jest.spyOn(globalThis, "fetch");
    try {
      const screen = await render(<ContactSupportScreen />);
      const input = screen.getByLabelText("Tell us your concern");
      expect(input.props.multiline).toBe(true);
      expect(input.props.numberOfLines).toBe(4);
      expect(input.props.placeholder).toBe("Tell us about your concern or question...");
      await fireEvent.changeText(input, "A question\nwith another line");
      expect(input.props.value).toBe("A question\nwith another line");
      expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
      await fireEvent.press(screen.getByRole("button", { name: "Submit" }));
      expect(screen.getByText("Submission coming soon")).toBeTruthy();
      expect(screen.getByText("Your text is not submitted or saved.")).toBeTruthy();
      expect(fetchSpy).not.toHaveBeenCalled();
      await screen.unmount();
      const reopened = await render(<ContactSupportScreen />);
      expect(reopened.getByLabelText("Tell us your concern").props.value).toBe("");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it.each(SUPPORT_FAQS)("pushes the correct public detail route for $question", async (faq) => {
    const screen = await render(<ContactSupportScreen />);
    const row = screen.getByRole("link", { name: faq.question });
    await fireEvent.press(row);
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/contact-support/faq/[faqId]",
      params: { faqId: faq.id },
    });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(row.props.accessibilityState?.expanded).toBeUndefined();
    expect(within(row).getByTestId("faq-chevron").props.accessibilityLabel).toBe("chevron-right");
    for (const text of approvedAnswerText) expect(screen.queryByText(text)).toBeNull();
  });

  it("preserves local concern text and disabled Submit when a FAQ is opened", async () => {
    const screen = await render(<ContactSupportScreen />);
    const input = screen.getByLabelText("Tell us your concern");
    await fireEvent.changeText(input, "Keep this temporary text");
    await fireEvent.press(screen.getByRole("link", { name: SUPPORT_FAQS[0].question }));
    expect(input.props.value).toBe("Keep this temporary text");
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
  });
});
