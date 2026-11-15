import { render, waitFor } from "@testing-library/react-native";
import MerchantPlusReturnRoute from "@/app/(merchant)/merchant-plus/return";
import { parseMerchantPlusReturnOutcome } from "../../../utils/merchantPlusReturn";

const mockRefetch = jest.fn().mockResolvedValue({ data: { has_plus_access: false } });
let mockOutcome: unknown;
const mockPost = jest.fn();

jest.mock("expo-router", () => ({
  router: { replace: jest.fn() },
  useLocalSearchParams: () => ({ outcome: mockOutcome }),
  useFocusEffect: (callback: () => void) => {
    require("react").useEffect(callback, [callback]);
  },
}));
jest.mock("../../../hooks/analytics/useMerchantPlusAccess", () => ({
  __esModule: true,
  default: () => ({ refetch: mockRefetch }),
}));
jest.mock("@/shared/api/apiClient.service", () => ({
  __esModule: true,
  default: { post: (...args: unknown[]) => mockPost(...args) },
}));

beforeEach(() => jest.clearAllMocks());

it.each(["success", "failure", "cancel"])("accepts %s only as a navigation hint", async (outcome) => {
  mockOutcome = outcome;
  expect(parseMerchantPlusReturnOutcome(outcome)).toBe(outcome);
  const screen = await render(<MerchantPlusReturnRoute />);
  await waitFor(() => expect(mockRefetch).toHaveBeenCalledTimes(1));
  expect(screen.getByText("Back in SugboGo")).toBeTruthy();
  expect(screen.queryByText(/Payment confirmed|Plus activated/)).toBeNull();
  expect(mockPost).not.toHaveBeenCalled();
});

it.each([undefined, "paid", ["success", "cancel"], "https://attacker.invalid"])("drops malformed hints %p", async (outcome) => {
  mockOutcome = outcome;
  expect(parseMerchantPlusReturnOutcome(outcome)).toBeNull();
  await render(<MerchantPlusReturnRoute />);
  expect(mockRefetch).toHaveBeenCalled();
  expect(mockPost).not.toHaveBeenCalled();
});
