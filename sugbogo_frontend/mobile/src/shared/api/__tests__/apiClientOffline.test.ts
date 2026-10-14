import MockAdapter from "axios-mock-adapter";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { createApiError } from "@/shared/utils/apiErrors";
import apiClient from "../apiClient.service";
import { clearTokens, getAccessToken } from "../storage.service";
import { refreshSession } from "../refresh.service";

jest.mock("../storage.service", () => ({
  getAccessToken: jest.fn(),
  clearTokens: jest.fn(),
}));
jest.mock("../refresh.service", () => ({ refreshSession: jest.fn() }));
jest.mock("expo-router", () => ({ router: { replace: jest.fn() } }));
jest.mock("@react-native-community/netinfo", () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
}));

const adapter = new MockAdapter(apiClient);

describe("refresh failure classification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    adapter.reset();
    (getAccessToken as jest.Mock).mockResolvedValue("expired-access");
    (clearTokens as jest.Mock).mockResolvedValue(undefined);
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      sessionExpired: false,
    });
    adapter.onGet("/users/me/").reply(401);
  });

  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"])(
    "preserves tokens on %s during refresh",
    async (code) => {
      (refreshSession as jest.Mock).mockRejectedValue(createApiError(code));
      await expect(apiClient.get("/users/me/")).rejects.toMatchObject({
        name: "NETWORK_ERROR",
      });
      expect(clearTokens).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    },
  );

  it("revokes authentication when refresh is rejected by the server", async () => {
    (refreshSession as jest.Mock).mockRejectedValue(
      new Error("Token rejected"),
    );
    await expect(apiClient.get("/users/me/")).rejects.toMatchObject({
      name: "AUTH_ERROR",
    });
    expect(clearTokens).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it("still clears runtime authentication if secure token deletion fails", async () => {
    (refreshSession as jest.Mock).mockRejectedValue(
      new Error("Token rejected"),
    );
    (clearTokens as jest.Mock).mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    await expect(apiClient.get("/users/me/")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
