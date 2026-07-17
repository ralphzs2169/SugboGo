import { establishSession } from "../authSession";

import { saveAccessToken, saveRefreshToken } from "@/shared/api/storage";

import { useAuthStore } from "../../store/auth.store";

/**
 * @file authSession.test.ts
 * @description Unit tests for authentication session handling.
 *
 * Verifies:
 * - JWT tokens are saved after authentication
 * - authenticated user is stored in Zustand
 *
 * Run:
 * npm test -- authSession.test.ts
 */

const mockSetUser = jest.fn();

jest.mock("@/shared/api/storage", () => ({
  saveAccessToken: jest.fn(),
  saveRefreshToken: jest.fn(),
}));

jest.mock("../../store/auth.store", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      setUser: mockSetUser,
    })),
  },
}));

const mockedSaveAccessToken = saveAccessToken as jest.Mock;

const mockedSaveRefreshToken = saveRefreshToken as jest.Mock;

describe("authSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("saves tokens and updates authenticated user", async () => {
    const user = {
      id: 1,
      email: "test@test.com",
      role: "EXPLORER",
      status: "ACTIVE",
      has_completed_interest_selection: false,
    };

    await establishSession({
      access: "access-token",
      refresh: "refresh-token",
      user,
    });

    expect(mockedSaveAccessToken).toHaveBeenCalledWith("access-token");

    expect(mockedSaveRefreshToken).toHaveBeenCalledWith("refresh-token");

    expect(mockSetUser).toHaveBeenCalledWith(user);
  });
});
