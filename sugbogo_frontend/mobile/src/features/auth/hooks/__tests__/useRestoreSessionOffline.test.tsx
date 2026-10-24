import {
  beginAuthSession,
  invalidateAuthSession,
} from "@/shared/api/authSessionGeneration.service";
import { act, renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "../../store/auth.store";
import { getCurrentUser } from "../../api/auth.service";
import {
  clearSessionTokens,
  getAccessToken,
} from "@/shared/api/storage.service";
import {
  clearOfflineAccess,
  getRestorableOfflineOwner,
  rememberOfflineResources,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { createApiError } from "@/shared/utils/apiErrors";
import { useRestoreSession } from "../useRestoreSession";
import { AxiosError } from "axios";
import { restoreRecentExploreAccess } from "@/features/explore/services/recentExplore.service";
jest.mock("@react-native-async-storage/async-storage", () =>
  jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  ),
);

jest.mock("@/features/explore/services/recentExplore.service", () => ({
  restoreRecentExploreAccess: jest.fn().mockResolvedValue(null),
}));

jest.mock("../../api/auth.service", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/shared/api/storage.service", () => ({
  getAccessToken: jest.fn(),
  clearSessionTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(),
  rememberOfflineResources: jest.fn().mockResolvedValue(undefined),
  getRestorableOfflineOwner: jest.fn(),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("offline startup boundary", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(rememberOfflineResources).mockResolvedValue(undefined);
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
    useOfflineAccessStore.setState({
      ownerId: null,
      isRevoking: false,
      recentExplore: null,
    });
    jest.mocked(restoreRecentExploreAccess).mockResolvedValue(null);
    (getAccessToken as jest.Mock).mockResolvedValue("stored-token");
    (getRestorableOfflineOwner as jest.Mock).mockResolvedValue(7);
    (clearSessionTokens as jest.Mock).mockResolvedValue(undefined);
    (clearOfflineAccess as jest.Mock).mockResolvedValue(undefined);
  });

  it.each([429, 500, 503])(
    "preserves credentials and offers recovery on HTTP %s",
    async (status) => {
      const error = Object.assign(new AxiosError("Temporarily unavailable"), {
        response: { status },
      });
      jest.mocked(getCurrentUser).mockRejectedValueOnce(error);
      const hook = await renderHook(() => useRestoreSession());
      await waitFor(() =>
        expect(hook.result.current.recoveryRequired).toBe(true),
      );
      expect(clearSessionTokens).not.toHaveBeenCalled();
      expect(getRestorableOfflineOwner).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useOfflineAccessStore.getState().ownerId).toBeNull();
      await hook.unmount();
    },
  );

  it.each([401, 403])(
    "clears credentials after authoritative HTTP %s rejection",
    async (status) => {
      jest
        .mocked(getCurrentUser)
        .mockRejectedValueOnce(
          Object.assign(new AxiosError("Authentication rejected"), {
            response: { status },
          }),
        );
      const hook = await renderHook(() => useRestoreSession());
      await waitFor(() =>
        expect(useAuthStore.getState().isLoading).toBe(false),
      );
      expect(clearSessionTokens).toHaveBeenCalledTimes(1);
      expect(hook.result.current.recoveryRequired).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      await hook.unmount();
    },
  );

  it("preserves credentials without granting offline ownership when storage cannot be read", async () => {
    jest
      .mocked(getAccessToken)
      .mockRejectedValueOnce(new Error("SecureStore unavailable"));
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() =>
      expect(hook.result.current.recoveryRequired).toBe(true),
    );
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getRestorableOfflineOwner).not.toHaveBeenCalled();
    expect(clearSessionTokens).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    await hook.unmount();
  });

  it("revalidates the stored session when Retry is selected", async () => {
    jest
      .mocked(getCurrentUser)
      .mockRejectedValueOnce(createApiError("NETWORK_ERROR"));
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() =>
      expect(hook.result.current.recoveryRequired).toBe(true),
    );
    jest.mocked(getCurrentUser).mockResolvedValueOnce({ id: 7 } as never);
    await act(async () => hook.result.current.retry());
    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(true),
    );
    expect(hook.result.current.recoveryRequired).toBe(false);
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(clearSessionTokens).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it("allows continuing to the existing offline/sign-in flow without erasing credentials", async () => {
    jest
      .mocked(getCurrentUser)
      .mockRejectedValueOnce(createApiError("NETWORK_ERROR"));
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() =>
      expect(hook.result.current.recoveryRequired).toBe(true),
    );
    await act(async () => hook.result.current.continueWithoutSession());
    expect(hook.result.current.recoveryRequired).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useOfflineAccessStore.getState().ownerId).toBe(7);
    expect(clearSessionTokens).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"])(
    "keeps tokens on %s and grants only local guidance access",
    async (name) => {
      (getCurrentUser as jest.Mock).mockRejectedValue(createApiError(name));
      const hook = await renderHook(() => useRestoreSession());
      await waitFor(() =>
        expect(useAuthStore.getState().isLoading).toBe(false),
      );
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useOfflineAccessStore.getState().ownerId).toBe(7);
      expect(clearSessionTokens).not.toHaveBeenCalled();
      hook.unmount();
    },
  );

  it("does not restore local access without a token", async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getRestorableOfflineOwner).not.toHaveBeenCalled();
    expect(clearOfflineAccess).toHaveBeenCalled();
    hook.unmount();
  });

  it("restores eligible Recent Explore alongside startup recovery", async () => {
    jest.mocked(getCurrentUser).mockRejectedValueOnce(
      createApiError("NETWORK_ERROR"),
    );
    const grant = { ownerId: 7, apiScope: "test", generation: 1 };
    jest.mocked(restoreRecentExploreAccess).mockResolvedValueOnce(grant);
    const hook = await renderHook(() => useRestoreSession());

    await waitFor(() =>
      expect(hook.result.current.recoveryRequired).toBe(true),
    );
    expect(useOfflineAccessStore.getState().recentExplore).toEqual(grant);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(clearSessionTokens).not.toHaveBeenCalled();
    await hook.unmount();
  });

  it("fails closed when the server rejects the session", async () => {
    (getCurrentUser as jest.Mock).mockRejectedValue(
      createApiError("AUTH_ERROR"),
    );
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(clearSessionTokens).toHaveBeenCalled();
    expect(getRestorableOfflineOwner).not.toHaveBeenCalled();
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    hook.unmount();
  });

  it("does not infer ownership when secure storage cannot be read", async () => {
    (getCurrentUser as jest.Mock).mockRejectedValue(
      createApiError("NETWORK_ERROR"),
    );
    (getRestorableOfflineOwner as jest.Mock).mockRejectedValue(
      new Error("storage unavailable"),
    );
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    hook.unmount();
  });

  it("does not restore a session after logout during the initial token read", async () => {
    const read = deferred<string | null>();
    jest.mocked(getAccessToken).mockReturnValueOnce(read.promise);
    const hook = await renderHook(() => useRestoreSession());
    invalidateAuthSession();
    await act(async () => read.resolve("old-token"));
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    hook.unmount();
  });

  it("does not grant old offline ownership after a newer login", async () => {
    const read = deferred<number | null>();
    jest.mocked(getRestorableOfflineOwner).mockReturnValueOnce(read.promise);
    jest
      .mocked(getCurrentUser)
      .mockRejectedValueOnce(createApiError("NETWORK_ERROR"));
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(getRestorableOfflineOwner).toHaveBeenCalled());
    beginAuthSession();
    useAuthStore.getState().setUser({ id: 8 } as never);
    await act(async () => read.resolve(7));
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(useAuthStore.getState().user?.id).toBe(8);
    expect(hook.result.current.recoveryRequired).toBe(false);
    hook.unmount();
  });

  it("restores authenticated access only after a successful server response", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({ id: 7 });
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    hook.unmount();
  });
});
