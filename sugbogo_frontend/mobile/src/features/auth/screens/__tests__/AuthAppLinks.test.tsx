import { Linking as NativeLinking, Platform, Text } from "react-native";
import { ExpoRoot } from "expo-router";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  getMockContext,
} from "expo-router/testing-library";

import ResetPasswordRoute from "@/app/(auth)/reset-password";
import VerifyEmailRoute from "@/app/(auth)/verify-email";
import OAuthRedirect from "@/app/oauthredirect";
import MerchantPlusReturnRoute from "@/app/(merchant)/merchant-plus/return";
import MerchantPlusRoute from "@/app/(merchant)/merchant-plus/index";
import MerchantPlusEntry from "@/features/merchant/components/merchant-plus/MerchantPlusEntry";

jest.mock("@/features/merchant/screens/merchant-mode/MerchantPlusScreen", () => ({
  __esModule: true,
  default: function MockOffer() {
    const { Text } = require("react-native");
    return <Text>Merchant Plus offer screen</Text>;
  },
}));
jest.mock("@/features/merchant/hooks/analytics/useMerchantPlusAccess", () => ({
  __esModule: true,
  default: () => ({ state: "restricted", allowed: false, status: { has_plus_access: false, access_source: "none" } }),
}));

jest.mock("@/features/merchant/screens/merchant-mode/MerchantPlusReturnScreen", () => ({
  __esModule: true,
  default: function MockPaymentReturn({ outcome }: { outcome: string | null }) {
    const { Text } = require("react-native");
    return <Text>{`Payment navigation hint: ${outcome ?? "none"}`}</Text>;
  },
}));

jest.mock("../../screens/VerifyEmailScreen", () => ({
  __esModule: true,
  default: function MockVerifyScreen() {
    const { Text } = require("react-native");
    const { useLocalSearchParams } = require("expo-router");
    const { uid, token } = useLocalSearchParams();
    return <Text>{`Verify proof: ${uid} ${token}`}</Text>;
  },
}));

jest.mock("../../screens/ResetPasswordScreen", () => ({
  __esModule: true,
  default: function MockResetScreen({
    proof,
  }: {
    proof?: { uid: string; token: string };
  }) {
    const { Text } = require("react-native");
    return <Text>{proof ? `Reset proof: ${proof.uid} ${proof.token}` : "Invalid reset link"}</Text>;
  },
}));

const mockLinkSubscription = jest.fn();

jest.mock("expo-linking", () => ({
  ...jest.requireActual("expo-linking"),
  createURL: (path: string) => `sugbogo://${path}`,
  addEventListener: (...args: unknown[]) => mockLinkSubscription(...args),
}));

const routes = getMockContext({
  index: () => <Text>Home</Text>,
  "(auth)/login": () => <Text>Login</Text>,
  "(auth)/reset-password": ResetPasswordRoute,
  "(auth)/verify-email": VerifyEmailRoute,
  oauthredirect: OAuthRedirect,
  "(merchant)/merchant-plus/return": MerchantPlusReturnRoute,
  "(merchant)/merchant-plus/index": MerchantPlusRoute,
  "(merchant)/(tabs)/analytics": () => <MerchantPlusEntry discovery />,
});

const origin = "https://sugbogo.app";
const query = "uid=Mz%51&token=example-token%5F123";
const routeCases = [
  ["verify-email", "Verify proof: MzQ example-token_123"],
  ["reset-password", "Reset proof: MzQ example-token_123"],
] as const;

beforeEach(() => {
  jest.replaceProperty(Platform, "OS", "android");
  mockLinkSubscription.mockReturnValue({ remove: jest.fn() });
});

afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});

function launchApp(url: string | null = null) {
  jest.spyOn(NativeLinking, "getInitialURL").mockResolvedValue(url);
  return render(<ExpoRoot context={routes} />);
}

it("opens the actual offer route by tapping the Merchant Plus card", async () => {
  const app = await launchApp("sugbogo://analytics");
  await fireEvent.press(await app.findByRole("button", { name: "Explore Merchant Plus" }));
  expect(await app.findByText("Merchant Plus offer screen")).toBeTruthy();
});

it("resolves the canonical Merchant Plus deep link without an index suffix", async () => {
  const app = await launchApp("sugbogo://merchant-plus");
  expect(await app.findByText("Merchant Plus offer screen")).toBeTruthy();
});

it.each([
  ["sugbogo", "success", "success"],
  ["sugbogo", "failure", "failure"],
  ["com.sugbogo.app", "cancel", "cancel"],
  ["sugbogo", "paid", "none"],
])("opens payment return from %s with only the %s hint", async (scheme, outcome, expected) => {
  const app = await launchApp(`${scheme}://merchant-plus/return?outcome=${outcome}`);
  expect(await app.findByText(`Payment navigation hint: ${expected}`)).toBeTruthy();
});

it.each(routeCases)(
  "opens /%s with the HTTPS proof on cold start",
  async (route, screenText) => {
    const app = await launchApp(`${origin}/${route}?${query}`);
    expect(await app.findByText(screenText)).toBeTruthy();
  },
);

it("routes incoming URL events with the new proof while the app is already open", async () => {
  let listener: ((event: { url: string }) => void) | undefined;
  mockLinkSubscription.mockImplementation((type, callback) => {
    if (type === "url") listener = callback;
    return { remove: jest.fn() };
  });
  const app = await launchApp();
  expect(await app.findByText("Home")).toBeTruthy();
  expect(listener).toBeDefined();

  await act(async () => listener?.({ url: `${origin}/verify-email?${query}` }));
  expect(app.getByText("Verify proof: MzQ example-token_123")).toBeTruthy();

  await act(async () => listener?.({ url: `${origin}/reset-password?${query}` }));
  expect(app.getByText("Reset proof: MzQ example-token_123")).toBeTruthy();

  await act(async () => listener?.({ url: `${origin}/reset-password?uid=NA&token=fresh-token` }));
  expect(app.getByText("Reset proof: NA fresh-token")).toBeTruthy();
});

it.each(["uid=MzQ", "uid=MzQ&token=", "uid=MzQ&uid=NA&token=duplicate"])(
  "routes a malformed HTTPS reset link to the existing invalid-link state (%s)",
  async (invalidQuery) => {
    const app = await launchApp(`${origin}/reset-password?${invalidQuery}`);
    expect(await app.findByText("Invalid reset link")).toBeTruthy();
  },
);

it.each([
  ["com.sugbogo.app", ...routeCases[0]],
  ["sugbogo", ...routeCases[1]],
])("continues routing %s://%s links", async (scheme, route, screenText) => {
  const app = await launchApp(`${scheme}://${route}?${query}`);
  expect(await app.findByText(screenText)).toBeTruthy();
});

it("preserves the existing OAuth callback route and login redirect", async () => {
  const app = await launchApp("com.sugbogo.app://oauthredirect");
  await waitFor(() => expect(app.getByText("Login")).toBeTruthy());
});
