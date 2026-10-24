import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";
import useBusinessProfileVisit from "../useBusinessProfileVisit";
import { recordBusinessProfileVisit } from "../../api/exploreBusiness.service";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("../../api/exploreBusiness.service", () => ({
  recordBusinessProfileVisit: jest.fn(),
}));
const record = jest.mocked(recordBusinessProfileVisit);

describe("source-bearing profile lifecycle", () => {
  let client: QueryClient;
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }
  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { gcTime: Infinity } },
    });
    mockFocused = true;
    AppState.currentState = "active";
    record.mockReset().mockResolvedValue({
      success: true,
      message: "Recorded",
      data: { business_id: 1, recorded: true, duplicate: false },
    });
  });
  afterEach(async () => {
    await cleanup();
    client.clear();
  });

  it.each([
    undefined,
    null,
    [],
    "MY_REVIEWS",
    "VOUCH_HISTORY",
    "NOTIFICATIONS",
  ])("keeps an unclassified opening counted as UNKNOWN: %s", async (source) => {
    await renderHook(() => useBusinessProfileVisit(1, 1, false, source), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(record).toHaveBeenCalledWith(1, "UNKNOWN"));
  });
  it("does not resubmit on source rerenders and does not leak a previous business's source", async () => {
    const { rerender } = await renderHook(
      ({ id, source }: { id: number; source: unknown }) =>
        useBusinessProfileVisit(id, id, false, source),
      { wrapper: Wrapper, initialProps: { id: 1, source: "MAP" } },
    );
    await waitFor(() => expect(record).toHaveBeenCalledWith(1, "MAP"));
    await rerender({ id: 1, source: "COMMUNITY" });
    expect(record).toHaveBeenCalledTimes(1);
    await rerender({ id: 2, source: undefined });
    await waitFor(() => expect(record).toHaveBeenLastCalledWith(2, "UNKNOWN"));
  });
  it("retries with the original immutable source even if route context changes", async () => {
    record.mockResolvedValueOnce({
      success: false,
      code: "NETWORK_ERROR",
      message: "Offline",
    });
    const { rerender } = await renderHook(
      ({ source }: { source: Parameters<typeof useBusinessProfileVisit>[3] }) =>
        useBusinessProfileVisit(1, 1, false, source),
      { wrapper: Wrapper, initialProps: { source: "MAP" } },
    );
    await waitFor(() => expect(record).toHaveBeenCalledTimes(1));
    await rerender({ source: "COMMUNITY" });
    await waitFor(() => expect(record).toHaveBeenCalledTimes(2), {
      timeout: 4000,
    });
    expect(record.mock.calls).toEqual([
      [1, "MAP"],
      [1, "MAP"],
    ]);
  });
});
