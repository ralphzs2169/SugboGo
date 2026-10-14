import { renderHook, waitFor } from "@testing-library/react-native";

import { useAuthStore } from "../../store/auth.store";
import { getCurrentUser } from "../../api/auth.service";
import { clearTokens, getAccessToken } from "@/shared/api/storage.service";
import {
  clearOfflineAccess,
  getOfflineOwner,
} from "@/features/offline-routes/services/offlineAccess.service";
import { useOfflineAccessStore } from "@/features/offline-routes/stores/offlineAccess.store";
import { createApiError } from "@/shared/utils/apiErrors";
import { useRestoreSession } from "../useRestoreSession";

jest.mock("../../api/auth.service", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/shared/api/storage.service", () => ({
  getAccessToken: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock("@/features/offline-routes/services/offlineAccess.service", () => ({
  clearOfflineAccess: jest.fn(),
  getOfflineOwner: jest.fn(),
}));

describe("offline startup boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
    useOfflineAccessStore.setState({ ownerId: null, isRevoking: false });
    (getAccessToken as jest.Mock).mockResolvedValue("stored-token");
    (getOfflineOwner as jest.Mock).mockResolvedValue(7);
    (clearTokens as jest.Mock).mockResolvedValue(undefined);
    (clearOfflineAccess as jest.Mock).mockResolvedValue(undefined);
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
      expect(clearTokens).not.toHaveBeenCalled();
      hook.unmount();
    },
  );

  it("does not restore local access without a token", async () => {
    (getAccessToken as jest.Mock).mockResolvedValue(null);
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getOfflineOwner).not.toHaveBeenCalled();
    expect(clearOfflineAccess).toHaveBeenCalled();
    hook.unmount();
  });

  it("fails closed when the server rejects the session", async () => {
    (getCurrentUser as jest.Mock).mockRejectedValue(
      createApiError("AUTH_ERROR"),
    );
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(clearTokens).toHaveBeenCalled();
    expect(getOfflineOwner).not.toHaveBeenCalled();
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    hook.unmount();
  });

  it("does not infer ownership when secure storage cannot be read", async () => {
    (getCurrentUser as jest.Mock).mockRejectedValue(
      createApiError("NETWORK_ERROR"),
    );
    (getOfflineOwner as jest.Mock).mockRejectedValue(
      new Error("storage unavailable"),
    );
    const hook = await renderHook(() => useRestoreSession());
    await waitFor(() => expect(useAuthStore.getState().isLoading).toBe(false));
    expect(useOfflineAccessStore.getState().ownerId).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
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
