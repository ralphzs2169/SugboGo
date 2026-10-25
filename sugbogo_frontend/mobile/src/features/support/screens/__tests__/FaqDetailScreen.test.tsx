import type { ReactNode } from "react";
import { fireEvent, render, within } from "@testing-library/react-native";
import { router, Stack } from "expo-router";

import FaqDetailRoute from "@/app/contact-support/faq/[faqId]";
import { defaultStackScreenOptions, slideFromRight } from "@/shared/navigation/stackOptions";
import { getSupportFaq, SUPPORT_FAQS } from "../../constants/supportFaqDraft";

// Expo's first native render can include several seconds of cold module transforms.
jest.setTimeout(15_000);

let mockFaqId: unknown;

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ faqId: mockFaqId }),
  router: { back: jest.fn(), replace: jest.fn() },
  Stack: {
    Screen: jest.fn(({ options }: { options: { headerTitle: () => ReactNode } }) =>
      options.headerTitle(),
    ),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: jest.requireActual("react-native").View,
}));

jest.mock("@expo/vector-icons", () => ({
  MaterialCommunityIcons: () => null,
}));

describe("Public FAQ detail pages", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFaqId = "what-is-sugbogo";
  });

  it("provides exactly the five approved destinations with their expected step counts", () => {
    expect(SUPPORT_FAQS.map((faq) => [faq.id, faq.question, faq.steps.length])).toEqual([
      ["what-is-sugbogo", "What is SugboGo?", 0],
      ["find-businesses", "How can I register my business on SugboGo?", 6],
      ["vouch-for-business", "How do I vouch for a business?", 4],
      ["my-pockets", "How do I save businesses to My Pockets?", 5],
      ["get-directions", "How can I get directions to a business?", 5],
    ]);
    for (const faq of SUPPORT_FAQS) expect(getSupportFaq(faq.id)).toBe(faq);
  });

  it.each(SUPPORT_FAQS)("renders $id with ordered guidance and approved supplementary content", async (faq) => {
    mockFaqId = faq.id;
    const screen = await render(<FaqDetailRoute />);
    const header = screen.getByRole("header", { name: faq.question });
    expect(header.props.numberOfLines).toBe(1);
    expect(header.props.ellipsizeMode).toBe("tail");
    expect(screen.getAllByText(faq.question)).toHaveLength(1);
    expect(screen.getByTestId("faq-detail-scroll").props.scrollEnabled).not.toBe(false);
    for (const paragraph of faq.paragraphs) expect(screen.getByText(paragraph)).toBeTruthy();

    if (faq.steps.length > 0) {
      const steps = within(screen.getByTestId("faq-steps"));
      expect(steps.getAllByLabelText(/^\d+\. /).map((step) => step.props.accessibilityLabel)).toEqual(
        faq.steps.map((step, index) => `${index + 1}. ${step}`),
      );
    } else {
      expect(screen.queryByTestId("faq-steps")).toBeNull();
      expect(screen.queryByText("Good to know")).toBeNull();
    }
    if (faq.explanation) {
      expect(screen.getByRole("header", { name: faq.explanation.heading })).toBeTruthy();
      expect(screen.getByText(faq.explanation.text)).toBeTruthy();
    }
    if (faq.goodToKnow) {
      expect(screen.getByRole("header", { name: "Good to know" })).toBeTruthy();
      for (const paragraph of faq.goodToKnow) expect(screen.getByText(paragraph)).toBeTruthy();
    }
    const options = jest.mocked(Stack.Screen).mock.lastCall?.[0].options;
    if (!options || typeof options === "function") {
      throw new Error("Expected static FAQ screen options");
    }
    expect(options.title).toBe(faq.question);
    expect(options.headerShown).toBe(true);
    expect(options.headerLeft).toBe(defaultStackScreenOptions.headerLeft);
    expect(options.headerTitleStyle).toBe(defaultStackScreenOptions.headerTitleStyle);
    expect(options.animation).toBe(slideFromRight.animation);
  });

  it.each([
    { value: undefined },
    { value: "" },
    { value: "unknown-faq" },
    { value: "__proto__" },
    { value: ["what-is-sugbogo"] },
  ])("safely handles invalid identifier $value and offers public recovery", async ({ value }) => {
    expect(getSupportFaq(value)).toBeUndefined();
    mockFaqId = value;
    const screen = await render(<FaqDetailRoute />);
    expect(screen.getByRole("header", { name: "FAQ unavailable" })).toBeTruthy();
    expect(screen.queryByTestId("faq-steps")).toBeNull();
    for (const faq of SUPPORT_FAQS) expect(screen.queryByText(faq.paragraphs[0])).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: "Back to Contact Support" }));
    expect(router.replace).toHaveBeenCalledWith("/contact-support");
  });
});
