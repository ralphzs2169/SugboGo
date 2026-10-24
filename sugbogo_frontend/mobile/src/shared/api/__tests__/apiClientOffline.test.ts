import { beginAuthSession } from "../authSessionGeneration.service";
import MockAdapter from "axios-mock-adapter";
import { AxiosError } from "axios";
import NetInfo from "@react-native-community/netinfo";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { createApiError } from "@/shared/utils/apiErrors";
import apiClient from "../apiClient.service";
import { clearSessionTokens, getAccessToken } from "../storage.service";
import { refreshSession } from "../refresh.service";

jest.mock("../storage.service", () => ({
  getAccessToken: jest.fn(),
  clearSessionTokens: jest.fn(),
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
    beginAuthSession();
    adapter.reset();
    (getAccessToken as jest.Mock).mockResolvedValue("expired-access");
    (clearSessionTokens as jest.Mock).mockResolvedValue(undefined);
    useAuthStore.setState({
      user: { id: 7 } as never,
      isAuthenticated: true,
      sessionExpired: false,
    });
    adapter.onGet("/users/me/").reply(401);
  });

  it("rejects an offline write before sending it to the server", async () => {
    jest.mocked(NetInfo.fetch).mockResolvedValueOnce({
      isConnected: false,
      isInternetReachable: false,
    } as never);
    await expect(apiClient.post("/offline-write/", {})).rejects.toMatchObject({
      name: "NETWORK_ERROR",
    });
    expect(adapter.history.post).toHaveLength(0);
  });

  it.each(["NETWORK_ERROR", "REQUEST_TIMEOUT"])(
    "preserves tokens on %s during refresh",
    async (code) => {
      (refreshSession as jest.Mock).mockRejectedValue(createApiError(code));
      await expect(apiClient.get("/users/me/")).rejects.toMatchObject({
        name: "NETWORK_ERROR",
      });
      expect(clearSessionTokens).not.toHaveBeenCalled();
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
    expect(clearSessionTokens).toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it.each([429, 500, 503])(
    "preserves the session on transient refresh HTTP %i",
    async (status) => {
      const error = new AxiosError("Unavailable");
      error.response = {
        status,
        data: {},
        headers: {},
        statusText: "Unavailable",
        config: {} as never,
      };
      (refreshSession as jest.Mock).mockRejectedValue(error);
      await expect(apiClient.get("/users/me/")).rejects.toBe(error);
      expect(clearSessionTokens).not.toHaveBeenCalled();
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    },
  );

  it("still clears runtime authentication if secure token deletion fails", async () => {
    (refreshSession as jest.Mock).mockRejectedValue(
      new Error("Token rejected"),
    );
    (clearSessionTokens as jest.Mock).mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    await expect(apiClient.get("/users/me/")).rejects.toThrow(
      "Storage unavailable",
    );
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
