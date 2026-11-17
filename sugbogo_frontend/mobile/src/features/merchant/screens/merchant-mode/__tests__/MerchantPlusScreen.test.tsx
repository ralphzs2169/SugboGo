import { fireEvent, render } from "@testing-library/react-native";
import MerchantPlusScreen from "../MerchantPlusScreen";
import MerchantPlusEntry from "../../../components/merchant-plus/MerchantPlusEntry";
import AnalyticsMoreInsights from "../../../components/analytics/AnalyticsMoreInsights";
import { plusStatus } from "../../../__tests__/merchantPlusAnalytics.fixtures";

let mockStatus = offer();
let mockError: unknown = null;
const mockStart = jest.fn();
const mockPush = jest.fn();
const mockRefetch = jest.fn();
let mockBusy = false;

function offer() {
  return {
    ...plusStatus(false),
    payment_mode: "test" as const,
    checkout_enabled: true,
    purchase_eligible: true,
    product: {
      code: "merchant_plus",
      version: "capstone-v1",
      name: "Merchant Plus",
      amount_centavos: 100,
      currency: "PHP",
      access_duration_days: 30,
      payment_type: "one-time",
    },
  };
}
jest.mock("expo-router", () => ({
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: jest.fn(),
  },
  useNavigation: () => ({ isFocused: () => true }),
}));
jest.mock("../../../hooks/analytics/useMerchantPlusAccess", () => ({
  __esModule: true,
  default: () => ({
    status: mockStatus,
    allowed: mockStatus.has_plus_access && !mockError,
    state: mockError
      ? "error"
      : mockStatus.has_plus_access
        ? "accessible"
        : "restricted",
    error: mockError,
    isFetching: false,
    refetch: mockRefetch,
  }),
}));
jest.mock("../../../hooks/payments/useMerchantPlusCheckout", () => ({
  __esModule: true,
  default: () => ({
    startCheckout: mockStart,
    busy: mockBusy,
    phase: mockBusy ? "preparing" : "idle",
    error: null,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStatus = offer();
  mockError = null;
  mockBusy = false;
});

it("presents the fixed offer and four benefits with an explicit Pay action", async () => {
  const screen = await render(<MerchantPlusScreen />);
  expect(screen.getByText("₱1.00")).toBeTruthy();
  expect(screen.getByText("30 days of Merchant Plus")).toBeTruthy();
  expect(
    screen.getByText("One-time payment · No automatic renewal"),
  ).toBeTruthy();
  for (const benefit of [
    "Peer comparisons",
    "Specialty trends",
    "Visit timing",
    "Business recommendations",
  ]) {
    expect(screen.getByText(benefit)).toBeTruthy();
  }
  expect(screen.queryByText("Review insights")).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Pay ₱1.00" }));
  expect(mockStart).toHaveBeenCalledTimes(1);
});

it("replaces the offer with access and real backend expiry", async () => {
  mockStatus = {
    ...offer(),
    has_plus_access: true,
    access_source: "maya_test",
    paid_payment_id: 7,
    entitlement_expires_at: "2026-12-15T04:00:00Z",
  } as typeof mockStatus;
  const screen = await render(<MerchantPlusScreen />);
  expect(screen.getByText("Merchant Plus is active")).toBeTruthy();
  expect(screen.getByText("Dec 15, 2026")).toBeTruthy();
  expect(screen.getByRole("button", { name: "View Analytics" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(screen.queryByText("30 days of Merchant Plus")).toBeNull();
  expect(screen.queryByRole("button", { name: "Pay ₱1.00" })).toBeNull();
});

it("checks availability again without starting checkout when it is unavailable", async () => {
  mockStatus = {
    ...offer(),
    checkout_enabled: false,
    has_plus_access: true,
    access_source: "preview",
  };
  const screen = await render(<MerchantPlusScreen />);
  expect(screen.getByText(/Preview mode:/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Pay ₱1.00" })).toBeNull();

  await fireEvent.press(screen.getByRole("button", { name: "Check again" }));

  expect(mockRefetch).toHaveBeenCalledTimes(1);
  expect(mockStart).not.toHaveBeenCalled();
});

it.each([
  ["preview", "Not active · Analytics preview"],
  ["mock", "Not active · Demo access"],
] as const)(
  "keeps %s report access separate from a paid Merchant Plus entitlement",
  async (source, label) => {
    mockStatus = {
      ...offer(),
      has_plus_access: true,
      access_source: source,
    } as typeof mockStatus;
    const screen = await render(<MerchantPlusEntry />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("Access enabled")).toBeNull();

    await screen.rerender(<MerchantPlusEntry discovery />);
    expect(
      screen.getByRole("button", { name: "Try 30 days for ₱1" }),
    ).toBeTruthy();

    await screen.rerender(<MerchantPlusScreen />);
    expect(screen.queryByText("Merchant Plus is active")).toBeNull();
    expect(screen.queryByText("Active until")).toBeNull();
    expect(screen.getByRole("button", { name: "Pay ₱1.00" })).toBeTruthy();
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it.each([
  ["pending", "Payment not confirmed"],
  ["unknown", "We're still checking this payment"],
  ["cancelled", "Checkout cancelled"],
  ["failed", "Payment wasn't completed"],
  ["expired", "Checkout expired"],
] as const)(
  "presents %s without inviting a second purchase",
  async (outcome, title) => {
    mockStatus = {
      ...offer(),
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending",
      unresolved_checkout_status: "creation_unknown",
      checkout_outcome: outcome,
    } as typeof mockStatus;
    const screen = await render(<MerchantPlusScreen />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Continue checkout" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay ₱1.00" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  },
);

it.each([
  ["expired", "Checkout expired"],
  ["failed", "Payment wasn't completed"],
  ["cancelled", "Checkout cancelled"],
] as const)(
  "offers an explicit retry for backend-authorized %s checkouts",
  async (outcome, title) => {
    const retryReference = "87654321-4321-4321-8321-876543218765";
    mockStatus = {
      ...offer(),
      purchase_eligible: false,
      checkout_can_resume: false,
      checkout_retry_reference: retryReference,
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending",
      checkout_outcome: outcome,
    };
    const screen = await render(<MerchantPlusScreen />);
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Continue checkout" })).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole("button", { name: "Try again" }));
    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledWith(retryReference);
  },
);

it("offers the existing Maya checkout without presenting it as an unconfirmed payment", async () => {
  mockStatus = {
    ...offer(),
    unresolved_payment_id: 1,
    unresolved_payment_provider: "maya",
    checkout_can_resume: true,
    unresolved_payment_status: "pending",
    unresolved_checkout_status: "ready",
    checkout_outcome: "pending",
  };
  const screen = await render(<MerchantPlusScreen />);

  expect(screen.getByText("Finish your checkout")).toBeTruthy();
  expect(
    screen.getByText(
      "You can continue your existing Maya checkout when you're ready.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Payment not confirmed")).toBeNull();
  expect(screen.queryByText("Payment verification")).toBeNull();
  expect(screen.queryByText("Payment pending")).toBeNull();
  expect(screen.queryByRole("button", { name: "Pay ₱1.00" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  expect(mockStart).not.toHaveBeenCalled();

  expect(
    screen.queryByRole("button", { name: "Check payment status" }),
  ).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();

  await fireEvent.press(
    screen.getByRole("button", { name: "Continue checkout" }),
  );
  expect(mockStart).toHaveBeenCalledTimes(1);
});

it("keeps a resumable Analytics entry as an offer and only navigates on Continue", async () => {
  mockStatus = {
    ...offer(),
    checkout_can_resume: true,
    unresolved_payment_id: 1,
    unresolved_payment_status: "pending",
    unresolved_checkout_status: "ready",
    checkout_outcome: "pending",
  };
  const screen = await render(<MerchantPlusEntry discovery />);

  expect(screen.getByText("Merchant Plus")).toBeTruthy();
  expect(screen.getByText("Know how you compare")).toBeTruthy();
  expect(screen.getByText("Checkout in progress")).toBeTruthy();
  expect(screen.queryByText("Payment not confirmed")).toBeNull();
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue checkout" }),
  );
  expect(mockPush).toHaveBeenCalledWith("/(merchant)/merchant-plus");
  expect(mockStart).not.toHaveBeenCalled();

  await screen.rerender(<MerchantPlusEntry />);
  expect(screen.getByText("Checkout in progress")).toBeTruthy();
  expect(screen.queryByText("Payment not confirmed")).toBeNull();
});

it.each([
  ["expired", "Checkout expired"],
  ["cancelled", "Checkout cancelled"],
  ["failed", "Payment wasn't completed"],
] as const)(
  "replaces resumable messaging with the backend %s outcome",
  async (outcome, label) => {
    mockStatus = {
      ...offer(),
      checkout_can_resume: true,
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending",
      unresolved_checkout_status: "ready",
      checkout_outcome: "pending",
    };
    const screen = await render(<MerchantPlusEntry discovery />);
    expect(screen.getByText("Checkout in progress")).toBeTruthy();

    mockStatus = {
      ...mockStatus,
      checkout_can_resume: false,
      checkout_outcome: outcome,
    };
    await screen.rerender(<MerchantPlusEntry discovery />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(screen.queryByText("Payment not confirmed")).toBeNull();
    expect(screen.queryByText("Checkout in progress")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Continue checkout" }),
    ).toBeNull();
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it("keeps paid activation authoritative over checkout resumability", async () => {
  mockStatus = {
    ...offer(),
    checkout_can_resume: true,
    unresolved_payment_id: 1,
    unresolved_payment_status: "paid",
    unresolved_fulfilment_status: "pending",
    checkout_outcome: "pending",
  };
  const screen = await render(<MerchantPlusEntry discovery />);
  expect(screen.getByText("Activating access")).toBeTruthy();
  expect(screen.queryByText("Checkout in progress")).toBeNull();
  expect(mockStart).not.toHaveBeenCalled();
});

it.each(["ready", "creating", "creation_unknown"])(
  "offers only status checking for a non-resumable %s checkout",
  async (checkoutState) => {
    mockStatus = {
      ...offer(),
      checkout_can_resume: false,
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending",
      unresolved_checkout_status: checkoutState,
      checkout_outcome:
        checkoutState === "creation_unknown" ? "unknown" : "pending",
    };
    const screen = await render(<MerchantPlusScreen />);
    expect(
      screen.queryByRole("button", { name: "Continue checkout" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Pay ₱1.00" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Check payment status" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/merchant-plus/return");
    expect(mockStart).not.toHaveBeenCalled();
  },
);

it("shows confirmed payment awaiting activation", async () => {
  mockStatus = {
    ...offer(),
    unresolved_payment_id: 1,
    unresolved_payment_status: "paid",
    unresolved_fulfilment_status: "pending",
    checkout_outcome: "cancelled",
    checkout_retry_reference: "87654321-4321-4321-8321-876543218765",
  } as typeof mockStatus;
  const screen = await render(<MerchantPlusScreen />);
  expect(screen.getByText("Payment confirmed")).toBeTruthy();
  expect(screen.getByText("Confirmed")).toBeTruthy();
  expect(screen.getByText("Activation pending")).toBeTruthy();
  expect(screen.queryByText("Active until")).toBeNull();
  expect(screen.queryByText("Checkout cancelled")).toBeNull();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
});

it("offers recovery when backend status fails", async () => {
  mockError = new Error("offline");
  const screen = await render(<MerchantPlusScreen />);
  await fireEvent.press(screen.getByRole("button", { name: /Try again/i }));
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockStart).not.toHaveBeenCalled();
});

it("announces preparing state and disables Pay", async () => {
  mockBusy = true;
  const screen = await render(<MerchantPlusScreen />);
  expect(
    screen.getByRole("button", { name: "Preparing secure checkout…" }).props
      .accessibilityState.disabled,
  ).toBe(true);
});

it("renders compact discovery and Business entries linked to the same screen", async () => {
  const screen = await render(<MerchantPlusEntry discovery />);
  expect(
    screen.getByText("One-time payment · No automatic renewal"),
  ).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", { name: "Try 30 days for ₱1" }),
  );
  expect(mockPush).toHaveBeenCalledWith("/(merchant)/merchant-plus");
  await screen.rerender(<MerchantPlusEntry />);
  expect(screen.getByText("Not active")).toBeTruthy();
  mockStatus = {
    ...offer(),
    has_plus_access: true,
    access_source: "maya_test",
    paid_payment_id: 7,
    entitlement_expires_at: "2026-12-15T04:00:00Z",
  } as typeof mockStatus;
  await screen.rerender(<MerchantPlusEntry />);
  expect(screen.getByText("Active until Dec 15, 2026")).toBeTruthy();
  await screen.rerender(<MerchantPlusEntry discovery />);
  expect(screen.getByText("Active until Dec 15, 2026")).toHaveStyle({
    color: "#166534",
  });
});

it("routes locked Further insights to Plus and restores report navigation after activation", async () => {
  const open = jest.fn();
  const screen = await render(<AnalyticsMoreInsights onOpen={open} />);
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Open Peer comparisons, Merchant Plus required",
    }),
  );
  expect(mockPush).toHaveBeenCalledWith("/(merchant)/merchant-plus");
  expect(open).not.toHaveBeenCalled();
  mockStatus = { ...offer(), has_plus_access: true };
  await screen.rerender(<AnalyticsMoreInsights onOpen={open} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Open Peer comparisons" }),
  );
  expect(open).toHaveBeenCalledWith("peers");
});

it.each([
  ["pending", "Payment not confirmed"],
  ["cancelled", "Checkout cancelled"],
  ["failed", "Payment wasn't completed"],
  ["expired", "Checkout expired"],
] as const)(
  "shows the backend %s outcome in the compact entry",
  async (outcome, label) => {
    mockStatus = {
      ...offer(),
      unresolved_payment_id: 1,
      unresolved_payment_status: "pending",
      checkout_outcome: outcome,
    };
    const screen = await render(<MerchantPlusEntry discovery />);
    expect(screen.getByText(label)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Try 30 days for ₱1" }),
    ).toBeNull();
    await fireEvent.press(
      screen.getByRole("button", { name: "Explore Merchant Plus" }),
    );
    expect(mockPush).toHaveBeenCalledWith("/(merchant)/merchant-plus");
  },
);

it("dismisses the Analytics offer without hiding the Business entry", async () => {
  const screen = await render(<MerchantPlusEntry discovery />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Dismiss Merchant Plus offer" }),
  );
  expect(
    screen.queryByRole("button", { name: "Try 30 days for ₱1" }),
  ).toBeNull();
  expect(mockPush).not.toHaveBeenCalled();

  await screen.rerender(<MerchantPlusEntry />);
  expect(
    screen.getByRole("button", { name: "Explore Merchant Plus" }),
  ).toBeTruthy();
});
