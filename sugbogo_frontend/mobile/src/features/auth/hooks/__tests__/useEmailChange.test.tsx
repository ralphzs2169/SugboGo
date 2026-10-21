import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import {
  cancelEmailChange,
  confirmEmailChange,
  getEmailChangeStatus,
  requestEmailChange,
} from "../../api/emailChange.service";
import { useAuthStore } from "../../store/auth.store";
import { useConfirmEmailChange, useEmailChange } from "../useEmailChange";
import { useLogout } from "../useLogout";
import {
  beginAuthSession,
  invalidateAuthSession,
  StaleAuthSessionError,
} from "@/shared/api/authSessionGeneration.service";

jest.mock("../../api/emailChange.service", () => ({
  cancelEmailChange: jest.fn(),
  confirmEmailChange: jest.fn(),
  getEmailChangeStatus: jest.fn(),
  requestEmailChange: jest.fn(),
}));
jest.mock("../useLogout");

const user = {
  id: 1,
  first_name: "Cebu",
  last_name: "Explorer",
  gender: null,
  email: "old@example.com",
  role: "explorer" as const,
  status: "active",
  has_completed_interest_selection: true,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
  has_usable_password: true,
};
const pending = {
  new_email: "new@example.com",
  expires_at: "2026-10-20T10:30:00Z",
};
const payload = {
  new_email: pending.new_email,
  current_password: "  Original739!  ",
};
const proof = {
  request_id: "request",
  token: "secret",
  current_password: payload.current_password,
};
const logout = jest.fn();
let client: QueryClient;
function Wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("Email change session and cache handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    beginAuthSession();
    useAuthStore.setState({ user, isAuthenticated: true });
    client = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity },
      },
    });
    jest
      .mocked(getEmailChangeStatus)
      .mockResolvedValue({
        success: true,
        message: "Loaded.",
        data: { current_email: user.email, pending: null },
      });
    jest
      .mocked(requestEmailChange)
      .mockResolvedValue({ success: true, message: "Sent.", data: pending });
    jest
      .mocked(cancelEmailChange)
      .mockResolvedValue({ success: true, message: "Cancelled.", data: null });
    jest
      .mocked(confirmEmailChange)
      .mockResolvedValue({
        success: true,
        message: "Confirmed.",
        data: { user_id: user.id, email: pending.new_email },
      });
    jest.mocked(useLogout).mockReturnValue({ logout });
    logout.mockImplementation(async () => {
      invalidateAuthSession();
      return true;
    });
  });
  afterEach(() => client.clear());

  it("restores pending state and updates only the pending destination on request", async () => {
    const { result } = await renderHook(() => useEmailChange(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    await act(async () => {
      await result.current.requestChange.mutateAsync(payload);
    });
    await waitFor(() =>
      expect(result.current.status.data?.pending).toEqual(pending),
    );
    expect(requestEmailChange).toHaveBeenCalledWith(payload);
    expect(useAuthStore.getState().user?.email).toBe(user.email);
    expect(logout).not.toHaveBeenCalled();
    await act(async () => {
      await result.current.cancelChange.mutateAsync();
    });
    await waitFor(() => expect(result.current.status.data?.pending).toBeNull());
    expect(cancelEmailChange).toHaveBeenCalledTimes(1);
  });

  it("does not allow a slow status response to overwrite a successful new request", async () => {
    let finish!: (
      response: Awaited<ReturnType<typeof getEmailChangeStatus>>,
    ) => void;
    jest.mocked(getEmailChangeStatus).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useEmailChange(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(getEmailChangeStatus).toHaveBeenCalled());
    await act(async () => {
      await result.current.requestChange.mutateAsync(payload);
    });
    await act(async () => {
      finish({
        success: true,
        message: "Old status.",
        data: { current_email: user.email, pending: null },
      });
    });
    await waitFor(() =>
      expect(result.current.status.data?.pending).toEqual(pending),
    );
  });

  it("retains pending state when sending or cancellation fails without retry", async () => {
    jest
      .mocked(getEmailChangeStatus)
      .mockResolvedValue({
        success: true,
        message: "Loaded.",
        data: { current_email: user.email, pending },
      });
    const failure = {
      success: false as const,
      message: "Unavailable.",
      code: "NETWORK_ERROR",
    };
    jest.mocked(requestEmailChange).mockResolvedValue(failure);
    jest.mocked(cancelEmailChange).mockResolvedValue(failure);
    const { result } = await renderHook(() => useEmailChange(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    await act(async () => {
      await expect(
        result.current.requestChange.mutateAsync(payload),
      ).rejects.toEqual(failure);
    });
    await waitFor(() =>
      expect(result.current.requestChange.isError).toBe(true),
    );
    await act(async () => {
      await expect(result.current.cancelChange.mutateAsync()).rejects.toEqual(
        failure,
      );
    });
    await waitFor(() => expect(result.current.cancelChange.isError).toBe(true));
    expect(result.current.status.data?.pending).toEqual(pending);
    expect(requestEmailChange).toHaveBeenCalledTimes(1);
    expect(cancelEmailChange).toHaveBeenCalledTimes(1);
  });

  it("ignores request responses arriving after a new login", async () => {
    let finish!: (
      response: Awaited<ReturnType<typeof requestEmailChange>>,
    ) => void;
    jest.mocked(requestEmailChange).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useEmailChange(), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(result.current.status.isSuccess).toBe(true));
    await act(async () => {
      const changing = result.current.requestChange.mutateAsync(payload);
      await Promise.resolve();
      beginAuthSession();
      finish({ success: true, message: "Sent.", data: pending });
      await expect(changing).rejects.toBeInstanceOf(StaleAuthSessionError);
    });
    await waitFor(() =>
      expect(result.current.requestChange.isError).toBe(true),
    );
    expect(client.getQueryData(["auth", "email-change", user.id])).toEqual({
      current_email: user.email,
      pending: null,
    });
  });

  it("cleans up the matching local account after verified confirmation", async () => {
    const { result } = await renderHook(() => useConfirmEmailChange(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(proof);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(confirmEmailChange).toHaveBeenCalledWith(proof);
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it.each([null, { ...user, id: 2 }])(
    "does not clear an unrelated local account or signed-out session",
    async (localUser) => {
      useAuthStore.setState({ user: localUser });
      const { result } = await renderHook(() => useConfirmEmailChange(), {
        wrapper: Wrapper,
      });
      await act(async () => {
        await result.current.mutateAsync(proof);
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(logout).not.toHaveBeenCalled();
    },
  );

  it("does not clear a newer login when confirmation finishes late", async () => {
    let finish!: (
      response: Awaited<ReturnType<typeof confirmEmailChange>>,
    ) => void;
    jest.mocked(confirmEmailChange).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = await renderHook(() => useConfirmEmailChange(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      const changing = result.current.mutateAsync(proof);
      await Promise.resolve();
      beginAuthSession();
      finish({
        success: true,
        message: "Changed.",
        data: { user_id: user.id, email: pending.new_email },
      });
      await changing;
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(logout).not.toHaveBeenCalled();
  });

  it("keeps local authentication when verification fails", async () => {
    const failure = {
      success: false as const,
      code: "VALIDATION_ERROR",
      message: "Invalid link.",
    };
    jest.mocked(confirmEmailChange).mockResolvedValue(failure);
    const { result } = await renderHook(() => useConfirmEmailChange(), {
      wrapper: Wrapper,
    });
    await act(async () => {
      await expect(result.current.mutateAsync(proof)).rejects.toEqual(failure);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(logout).not.toHaveBeenCalled();
  });
});
