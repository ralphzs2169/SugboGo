import React, { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { getDuplicateWarning } from "../../../api/merchantApplication.service";
import useDuplicateWarning from "../useDuplicateWarning";

jest.mock("@/features/auth/store/auth.store", () => ({
  useAuthStore: (selector: (state: { user: { id: number } }) => unknown) =>
    selector({ user: { id: 42 } }),
}));
jest.mock("../../../api/merchantApplication.service", () => ({
  getDuplicateWarning: jest.fn(),
}));

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("saved duplicate warning", () => {
  it("checks only sufficient saved evidence and reuses an unchanged result", async () => {
    (getDuplicateWarning as jest.Mock).mockResolvedValue({
      success: true,
      data: { evaluated: true, possible_duplicate: true },
    });
    const { result, rerender } = await renderHook(
      ({ evidence, saved }: {
        evidence: Parameters<typeof useDuplicateWarning>[0];
        saved: Parameters<typeof useDuplicateWarning>[1];
      }) => useDuplicateWarning(evidence, saved),
      {
        initialProps: { evidence: "", saved: false },
        wrapper: createWrapper(),
      },
    );
    expect(getDuplicateWarning).not.toHaveBeenCalled();
    await rerender({ evidence: "saved-name-and-location", saved: true });
    await waitFor(() =>
      expect(result.current.data?.possible_duplicate).toBe(true),
    );
    await rerender({ evidence: "saved-name-and-location", saved: true });
    expect(getDuplicateWarning).toHaveBeenCalledTimes(1);
  });

  it("does not present failed detection as a successful negative result", async () => {
    (getDuplicateWarning as jest.Mock).mockRejectedValue(new Error("offline"));
    const { result } = await renderHook(
      () => useDuplicateWarning("saved", true),
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("ignores late responses belonging to earlier saved name/location evidence", async () => {
    let finishOld: (value: unknown) => void = () => undefined;
    (getDuplicateWarning as jest.Mock)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockResolvedValueOnce({
        success: true,
        data: { evaluated: true, possible_duplicate: false },
      });
    const { result, rerender } = await renderHook(
      ({ evidence }: { evidence: Parameters<typeof useDuplicateWarning>[0] }) =>
        useDuplicateWarning(evidence, true),
      { initialProps: { evidence: "old" }, wrapper: createWrapper() },
    );
    await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(1));
    await rerender({ evidence: "new" });
    await waitFor(() =>
      expect(result.current.data?.possible_duplicate).toBe(false),
    );
    await act(async () => {
      finishOld({
        success: true,
        data: { evaluated: true, possible_duplicate: true },
      });
    });
    expect(result.current.data?.possible_duplicate).toBe(false);
  });

  it("does not check dirty unsaved form values", async () => {
    await renderHook(() => useDuplicateWarning("saved", false), {
      wrapper: createWrapper(),
    });
    expect(getDuplicateWarning).not.toHaveBeenCalled();
  });

  it("aborts an in-flight check when the location warning unmounts", async () => {
    (getDuplicateWarning as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    const { unmount } = await renderHook(
      () => useDuplicateWarning("saved", true),
      {
        wrapper: createWrapper(),
      },
    );
    await waitFor(() => expect(getDuplicateWarning).toHaveBeenCalledTimes(1));
    const signal = (getDuplicateWarning as jest.Mock).mock
      .calls[0][0] as AbortSignal;
    expect(signal.aborted).toBe(false);
    await unmount();
    expect(signal.aborted).toBe(true);
  });
});
