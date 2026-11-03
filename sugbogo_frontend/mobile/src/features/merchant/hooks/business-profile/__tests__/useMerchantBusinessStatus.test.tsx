import useMerchantBusinessProfile from "../useMerchantBusinessProfile";
import { getMerchantBusinessProfile , getMerchantBusinessStatus } from "../../../api/merchantBusinessProfile.service";
import type { PropsWithChildren } from "react";
import {
  act,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import {
  onlineManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { beginAuthSession } from "@/shared/api/authSessionGeneration.service";
import useMerchantBusinessStatus from "../useMerchantBusinessStatus";
import MerchantBusinessStatusNotice from "../../../components/business-profile/MerchantBusinessStatusNotice";

jest.mock("../../../api/merchantBusinessProfile.service", () => ({
  getMerchantBusinessStatus: jest.fn(),
  getMerchantBusinessProfile: jest.fn(),
}));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));
jest.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) =>
    jest.requireActual("react").useEffect(callback, [callback]),
}));
let client: QueryClient;
const fixture = {
  business_id: 21,
  status: "active" as "active" | "suspended",
  transition_id: 0,
  owner_account_status: "active",
  suspension_reason: null as string | null,
  updated_at: "2026-11-02T02:00:00Z",
};
const ok = (status = fixture) => ({
  success: true as const,
  message: "Loaded",
  data: status,
});
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
beforeEach(() => {
  onlineManager.setOnline(true);
  beginAuthSession();
  useAuthStore.setState({
    user: { id: 7, role: "merchant" } as never,
    isAuthenticated: true,
    isLoading: false,
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  jest.mocked(getMerchantBusinessStatus).mockReset().mockResolvedValue(ok());
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
});
it("deduplicates mounted merchant status readers and exposes actual suspension reason", async () => {
  jest.mocked(getMerchantBusinessStatus).mockResolvedValue(
    ok({
      ...fixture,
      status: "suspended",
      suspension_reason: "Please correct the listing address.",
    }),
  );
  const hook = await renderHook(
    () => [useMerchantBusinessStatus(), useMerchantBusinessStatus()],
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current[0].data?.status).toBe("suspended"),
  );
  expect(getMerchantBusinessStatus).toHaveBeenCalledTimes(1);
  const view = await render(
    <MerchantBusinessStatusNotice query={hook.result.current[0]} />,
  );
  expect(view.getByText(/Please correct the listing address/)).toBeTruthy();
  expect(view.getByText(/data has been preserved/)).toBeTruthy();
});
it("active and reactivated status has no suspension banner", async () => {
  jest.mocked(getMerchantBusinessStatus).mockResolvedValue(
    ok({
      ...fixture,
      status: "suspended",
      suspension_reason: "Correction required",
    }),
  );
  const hook = await renderHook(() => useMerchantBusinessStatus(), {
    wrapper: Wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.data?.status).toBe("suspended"),
  );
  jest.mocked(getMerchantBusinessStatus).mockResolvedValue(ok());
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => expect(hook.result.current.data?.status).toBe("active"));
  const view = await render(
    <MerchantBusinessStatusNotice query={hook.result.current} />,
  );
  expect(view.queryByText("Business Suspended")).toBeNull();
});
it("failed verification exposes persistent Retry rather than active or suspended state", async () => {
  jest.mocked(getMerchantBusinessStatus).mockResolvedValue({
    success: false,
    code: "NETWORK_ERROR",
    message: "Offline",
  });
  const hook = await renderHook(() => useMerchantBusinessStatus(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.isError).toBe(true));
  const view = await render(
    <MerchantBusinessStatusNotice query={hook.result.current} />,
  );
  expect(view.getByText("Unable to verify business status")).toBeTruthy();
  expect(view.getByRole("button", { name: /Tap to retry/ })).toBeTruthy();
  expect(hook.result.current.data).toBeUndefined();
});
it("late status from a replaced account is rejected", async () => {
  let finish: (value: ReturnType<typeof ok>) => void = () => {};
  jest.mocked(getMerchantBusinessStatus).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const hook = await renderHook(() => useMerchantBusinessStatus(), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(getMerchantBusinessStatus).toHaveBeenCalled());
  await act(async () => {
    beginAuthSession();
    useAuthStore.setState({ user: { id: 8, role: "merchant" } as never });
    finish(ok());
  });
  expect(hook.result.current.data).toBeUndefined();
});

it("failed status verification preserves readable data but cannot authorize editing from cached active profile", async () => {
  jest
    .mocked(getMerchantBusinessProfile)
    .mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { id: 21, status: "active", business_name: "Saved Merchant" },
    } as never);
  jest
    .mocked(getMerchantBusinessStatus)
    .mockResolvedValue({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
  const hook = await renderHook(() => useMerchantBusinessProfile(), {
    wrapper: Wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.statusQuery.isError).toBe(true),
  );
  await waitFor(() => expect(hook.result.current.business?.id).toBe(21));
  expect(hook.result.current.business?.status).toBeNull();
  jest.mocked(getMerchantBusinessStatus).mockResolvedValue(ok());
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() =>
    expect(hook.result.current.business?.status).toBe("active"),
  );
});

it("keeps a stable profile object across unrelated renders so merchant drafts are preserved", async () => {
  jest
    .mocked(getMerchantBusinessProfile)
    .mockResolvedValue({
      success: true,
      message: "Loaded",
      data: { id: 21, status: "active", business_name: "Saved Merchant" },
    } as never);
  const hook = await renderHook(() => useMerchantBusinessProfile(), {
    wrapper: Wrapper,
  });
  await waitFor(() =>
    expect(hook.result.current.business?.status).toBe("active"),
  );
  const original = hook.result.current.business;
  await hook.rerender({});
  expect(hook.result.current.business).toBe(original);
});
