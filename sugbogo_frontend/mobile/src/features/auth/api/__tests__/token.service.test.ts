import MockAdapter from "axios-mock-adapter";
import NetInfo from "@react-native-community/netinfo";
import authClient from "@/shared/api/authClient.service";
import { refreshAccessToken, revokeRefreshToken } from "../token.service";

jest.mock("@react-native-community/netinfo", () => ({
  __esModule: true,
  default: { fetch: jest.fn() },
}));

const mock = new MockAdapter(authClient);

describe("session token API", () => {
  beforeEach(() => {
    mock.reset();
    jest
      .mocked(NetInfo.fetch)
      .mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      } as Awaited<ReturnType<typeof NetInfo.fetch>>);
  });
  afterAll(() => mock.restore());

  it("returns successful rotated tokens", async () => {
    mock
      .onPost("/auth/refresh/")
      .reply(200, { access: "new-access", refresh: "new-refresh" });
    await expect(refreshAccessToken("old-refresh")).resolves.toEqual({
      access: "new-access",
      refresh: "new-refresh",
    });
  });

  it.each([401, 429, 503])(
    "rejects HTTP %i instead of returning undefined access",
    async (status) => {
      mock
        .onPost("/auth/refresh/")
        .reply(status, { success: false, message: "Unavailable" });
      await expect(refreshAccessToken("old-refresh")).rejects.toMatchObject({
        response: { status },
      });
    },
  );

  it("rejects a successful response missing its access token", async () => {
    mock.onPost("/auth/refresh/").reply(200, { refresh: "new-refresh" });
    await expect(refreshAccessToken("old-refresh")).rejects.toThrow(
      "Invalid refresh response",
    );
  });

  it("posts captured refresh credentials to logout without an access-token refresh", async () => {
    mock.onPost("/auth/logout/").reply((config) => {
      expect(JSON.parse(config.data)).toEqual({ refresh: "old-refresh" });
      expect(config.timeout).toBe(5000);
      expect(config.headers?.Authorization).toBeUndefined();
      return [205, {}];
    });
    await expect(revokeRefreshToken("old-refresh")).resolves.toBeUndefined();
  });
});
