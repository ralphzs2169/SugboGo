import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";

import { changePassword } from "../../api/auth.service";
import { useChangePassword } from "../useChangePassword";
import { useLogout } from "../useLogout";
import {
  beginAuthSession,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

jest.mock("../../api/auth.service", () => ({ changePassword: jest.fn() }));
jest.mock("../useLogout");
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("react-native-toast-message", () => ({ show: jest.fn() }));

const payload = {
  current_password: "Original739!",
  new_password: "Replacement981!",
  confirm_password: "Replacement981!",
};
const logout = jest.fn();
let client: QueryClient;

function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useChangePassword", () => {
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

  it("cleans up the local session and routes to login only after backend success", async () => {
    jest
      .mocked(changePassword)
      .mockResolvedValue({ success: true, message: "Changed.", data: null });
    const { result } = await renderHook(() => useChangePassword(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(payload);
    });
    expect(changePassword).toHaveBeenCalledWith(payload);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(router.replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("does not sign out or navigate when validation fails", async () => {
    const failure = {
      success: false as const,
      code: "VALIDATION_ERROR",
      message: "Incorrect password.",
    };
    jest.mocked(changePassword).mockResolvedValue(failure);
    const { result } = await renderHook(() => useChangePassword(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.mutateAsync(payload)).rejects.toEqual(
        failure,
      );
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(logout).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("does not sign out a newer login when the old request finishes late", async () => {
    let finish!: (value: Awaited<ReturnType<typeof changePassword>>) => void;
    jest.mocked(changePassword).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useChangePassword(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      const pending = result.current.mutateAsync(payload);
      await Promise.resolve();
      beginAuthSession();
      finish({ success: true, message: "Changed.", data: null });
      await expect(pending).rejects.toBeInstanceOf(StaleAuthSessionError);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(logout).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
