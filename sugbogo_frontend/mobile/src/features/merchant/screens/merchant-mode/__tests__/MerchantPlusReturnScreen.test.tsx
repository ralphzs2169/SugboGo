import { render } from "@testing-library/react-native";
import MerchantPlusReturnRoute from "@/app/(merchant)/merchant-plus/return";
import { parseMerchantPlusReturnOutcome } from "../../../utils/merchantPlusReturn";
import { plusStatus } from "../../../__tests__/merchantPlusAnalytics.fixtures";

let mockOutcome: unknown;
let mockStatus = {
  ...plusStatus(false),
  unresolved_payment_id: 1,
  checkout_outcome: "pending",
};
const mockCheck = jest.fn();
let mockError: unknown = null;
let mockExhausted = false;
jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ outcome: mockOutcome }),
}));
jest.mock("../../../hooks/payments/useMerchantPlusPaymentStatus", () => ({
  __esModule: true,
  default: () => ({
    status: mockStatus,
    allowed: mockStatus.has_plus_access,
    error: mockError,
    exhausted: mockExhausted,
    checkAgain: mockCheck,
  }),
}));
beforeEach(() => {
  mockError = null;
  mockExhausted = false;
  mockStatus = {
    ...plusStatus(false),
    unresolved_payment_id: 1,
    checkout_outcome: "pending",
  };
});

it("offers recoverable backend status errors without creating checkout", async () => {
  mockError = new Error("offline");
  const screen = await render(<MerchantPlusReturnRoute />);
  expect(screen.getByText("Unable to check payment status")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
});

it("offers manual recovery and Analytics after bounded polling ends", async () => {
  mockExhausted = true;
  const screen = await render(<MerchantPlusReturnRoute />);
  expect(screen.getByText("Still processing")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Check status again" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Return to Analytics" })).toBeTruthy();
});
it.each(["success", "failure", "cancel"])(
  "does not infer paid access from %s",
  async (outcome) => {
    mockOutcome = outcome;
    const screen = await render(<MerchantPlusReturnRoute />);
    expect(screen.getByText("Checking your payment")).toBeTruthy();
    expect(screen.queryByText("Merchant Plus is active")).toBeNull();
  },
);
it.each(["failure", "cancel"])(
  "does not override backend activation with %s",
  async (outcome) => {
    mockOutcome = outcome;
    mockStatus = {
      ...mockStatus,
      has_plus_access: true,
      access_source: "maya_test",
      paid_payment_id: 7,
      entitlement_expires_at: "2026-12-15T04:00:00Z",
    } as typeof mockStatus;
    const screen = await render(<MerchantPlusReturnRoute />);
    expect(screen.getByText("Merchant Plus is active")).toBeTruthy();
  },
);
it("does not mistake analytics preview for payment confirmation on return", async () => {
  mockOutcome = "success";
  mockStatus = {
    ...mockStatus,
    has_plus_access: true,
    access_source: "preview",
  };
  const screen = await render(<MerchantPlusReturnRoute />);
  expect(screen.getByText("Checking your payment")).toBeTruthy();
  expect(screen.queryByText("Merchant Plus is active")).toBeNull();
});
it.each([undefined, "paid", ["success", "cancel"], "https://attacker.invalid"])(
  "drops malformed hints %p",
  (outcome) => {
    expect(parseMerchantPlusReturnOutcome(outcome)).toBeNull();
  },
);
