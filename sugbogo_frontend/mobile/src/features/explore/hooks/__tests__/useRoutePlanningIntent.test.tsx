import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  renderHook,
  waitFor,
} from "@testing-library/react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { analyticsMerchant } from "@/features/merchant/__tests__/merchantAnalytics.fixtures";
import { recordRoutePlanningIntent } from "../../api/routePlanningIntent.service";
import useRoutePlanningIntent from "../useRoutePlanningIntent";

jest.mock("../../api/routePlanningIntent.service", () => ({
  recordRoutePlanningIntent: jest.fn(),
}));
const submit = jest.mocked(recordRoutePlanningIntent);

describe("action-only route intent", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    client = new QueryClient({
      defaultOptions: { mutations: { retry: 3, gcTime: Infinity } },
    });
    useAuthStore.setState({
      user: { ...analyticsMerchant(), role: "explorer" },
    });
    submit.mockReset().mockResolvedValue({
      success: true,
      message: "Recorded",
      data: {
        business_id: 21,
        navigation_method: "ROAD_ROUTE",
        recorded: true,
        duplicate: false,
        excluded_reason: null,
      },
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
    useAuthStore.setState({ user: null });
    jest.restoreAllMocks();
  });

  it("does nothing on mount or rerender and sends the chosen method only when invoked", async () => {
    const { result, rerender } = await renderHook(
      () => useRoutePlanningIntent(21, false),
      { wrapper: Wrapper },
    );
    await rerender({});
    expect(submit).not.toHaveBeenCalled();
    await act(async () => result.current("ROAD_ROUTE"));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(21, "ROAD_ROUTE"));
    await act(async () => result.current("JEEPNEY"));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(2));
  });

  it.each(["NETWORK_ERROR", "ROUTE_PLANNING_UNAVAILABLE"])(
    "settles %s without retrying or rejecting the navigation handler",
    async (code) => {
      submit.mockResolvedValue({
        success: false,
        code,
        message: "Unavailable",
      });
      const { result } = await renderHook(
        () => useRoutePlanningIntent(21, false),
        { wrapper: Wrapper },
      );
      const navigate = jest.fn();
      await act(async () => {
        result.current("ROAD_ROUTE");
        navigate();
      });
      await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
      await waitFor(() =>
        expect(client.getMutationCache().getAll()[0].state.status).toBe(
          "error",
        ),
      );
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(client.getMutationCache().getAll()[0].options.retry).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        "[route-intent] submission failed",
        { method: "ROAD_ROUTE", code },
      );
    },
  );

  it("leaves guest navigation and owner previews untracked but allows other merchants", async () => {
    const { result, rerender } = await renderHook(
      ({ own }: { own: boolean }) => useRoutePlanningIntent(21, own),
      { wrapper: Wrapper, initialProps: { own: false } },
    );
    useAuthStore.setState({ user: null });
    await act(async () => result.current("ROAD_ROUTE"));
    expect(submit).not.toHaveBeenCalled();
    useAuthStore.setState({ user: analyticsMerchant() });
    await rerender({ own: true });
    await act(async () => result.current("JEEPNEY"));
    expect(submit).not.toHaveBeenCalled();
    await rerender({ own: false });
    await act(async () => result.current("JEEPNEY"));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(21, "JEEPNEY"));
  });
  it("diagnoses inactive-account and invalid-target suppression without logging identity", async () => {
    const { result } = await renderHook(
      () => useRoutePlanningIntent(0, false),
      {
        wrapper: Wrapper,
      },
    );
    await act(async () => result.current("ROAD_ROUTE"));
    expect(console.debug).toHaveBeenCalledWith("[route-intent] skipped", {
      reason: "invalid_business",
    });
    useAuthStore.setState({
      user: { ...analyticsMerchant(), status: "suspended" },
    });
    await act(async () => result.current("ROAD_ROUTE"));
    expect(console.debug).toHaveBeenCalledWith("[route-intent] skipped", {
      reason: "inactive_account",
    });
    expect(submit).not.toHaveBeenCalled();
  });
  it("diagnoses a successful deduplicated response without issuing another submission", async () => {
    submit.mockResolvedValue({
      success: true,
      message: "Recorded",
      data: {
        business_id: 21,
        navigation_method: "ROAD_ROUTE",
        recorded: false,
        duplicate: true,
        excluded_reason: null,
      },
    });
    const { result } = await renderHook(
      () => useRoutePlanningIntent(21, false),
      {
        wrapper: Wrapper,
      },
    );
    await act(async () => result.current("ROAD_ROUTE"));
    await waitFor(() =>
      expect(console.debug).toHaveBeenCalledWith("[route-intent] result", {
        method: "ROAD_ROUTE",
        recorded: false,
        duplicate: true,
        ownerExcluded: false,
      }),
    );
    expect(submit).toHaveBeenCalledTimes(1);
  });
  it("omits development diagnostics in release builds while still submitting", async () => {
    jest.replaceProperty(globalThis, "__DEV__", false);
    const { result } = await renderHook(() => useRoutePlanningIntent(21, false), {
      wrapper: Wrapper,
    });
    await act(async () => result.current("JEEPNEY"));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(21, "JEEPNEY"));
    expect(console.debug).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
  });
});
