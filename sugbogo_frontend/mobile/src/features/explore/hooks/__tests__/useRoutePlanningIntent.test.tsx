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
    client = new QueryClient({
      defaultOptions: { mutations: { retry: 3, gcTime: Infinity } },
    });
    useAuthStore.setState({
      user: { ...analyticsMerchant(), role: "explorer" },
    });
    submit
      .mockReset()
      .mockResolvedValue({
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
});
