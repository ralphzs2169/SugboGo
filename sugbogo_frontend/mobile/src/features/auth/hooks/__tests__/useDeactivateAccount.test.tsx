import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { deactivateAccount } from "../../api/auth.service";
import { useDeactivateAccount } from "../useDeactivateAccount";
import { useLogout } from "../useLogout";
import {
  beginAuthSession,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

jest.mock("../../api/auth.service", () => ({ deactivateAccount: jest.fn() }));
jest.mock("../useLogout");
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const payload = {
  current_password: "Original739!",
  confirm_deactivation: true as const,
};
const logout = jest.fn();
let client: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useDeactivateAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
    });
    (useLogout as jest.Mock).mockReturnValue({ logout });
    logout.mockImplementation(async () => {
      invalidateAuthSession();
      return true;
    });
  });
  afterEach(() => client.clear());

  it("clears the local session and navigates only after server success", async () => {
    jest.mocked(deactivateAccount).mockResolvedValue({
      success: true,
      message: "Deactivated.",
      data: null,
    });
    const { result } = await renderHook(() => useDeactivateAccount(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deactivateAccount).toHaveBeenCalledWith(payload);
    expect(logout).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it.each(["VALIDATION_ERROR", "NETWORK_ERROR", "RATE_LIMIT_EXCEEDED"])(
    "preserves local login on %s and never retries automatically",
    async (code) => {
      const failure = { success: false as const, code, message: "Try again." };
      jest.mocked(deactivateAccount).mockResolvedValue(failure);
      const { result } = await renderHook(() => useDeactivateAccount(), {
        wrapper: Wrapper,
      });
      await act(async () => {
        await expect(result.current.mutateAsync(payload)).rejects.toEqual(
          failure,
        );
      });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(deactivateAccount).toHaveBeenCalledTimes(1);
      expect(logout).not.toHaveBeenCalled();
      expect(router.replace).not.toHaveBeenCalled();
    },
  );

  it("does not clear a newer login when an old response finishes late", async () => {
    let finish!: (value: Awaited<ReturnType<typeof deactivateAccount>>) => void;
    jest.mocked(deactivateAccount).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useDeactivateAccount(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      const pending = result.current.mutateAsync(payload);
      await Promise.resolve();
      beginAuthSession();
      finish({ success: true, message: "Deactivated.", data: null });
      await expect(pending).rejects.toBeInstanceOf(StaleAuthSessionError);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(logout).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not redirect a new session established during cleanup", async () => {
    jest.mocked(deactivateAccount).mockResolvedValue({
      success: true,
      message: "Deactivated.",
      data: null,
    });
    logout.mockImplementation(() => {
      invalidateAuthSession();
      return Promise.resolve().then(() => {
        beginAuthSession();
        return true;
      });
    });
    const { result } = await renderHook(() => useDeactivateAccount(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
