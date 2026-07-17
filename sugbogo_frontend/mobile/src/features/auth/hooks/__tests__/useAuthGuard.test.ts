import { renderHook } from "@testing-library/react-native";

import { useAuthGuard } from "../useAuthGuard";

import { useAuthStore } from "../../store/auth.store";

import { useRouter } from "expo-router";

/**
 * @file useAuthGuard.test.ts
 * @description Unit tests for the authentication route guard hook.
 *
 * Verifies:
 *
 * - authenticated users are allowed to continue without redirecting
 * - unauthenticated users are redirected to login after loading completes
 * - redirects are skipped while authentication state is restoring
 *
 * Run:
 * npm test -- useAuthGuard.test.ts
 */

jest.mock("expo-router", () => ({
  useRouter: jest.fn(),
}));

jest.mock("../../store/auth.store", () => ({
  useAuthStore: jest.fn(),
}));

const mockedUseRouter = useRouter as jest.Mock;

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

describe("useAuthGuard", () => {
  const replace = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockedUseRouter.mockReturnValue({
      replace,
    });
  });

  it("does not redirect while authentication is loading", () => {
    mockedUseAuthStore.mockImplementation((selector) =>
      selector({
        isAuthenticated: false,
        isLoading: true,
      }),
    );

    renderHook(() => useAuthGuard());

    expect(replace).not.toHaveBeenCalled();
  });

  it("redirects unauthenticated users after loading completes", async () => {
    mockedUseAuthStore.mockImplementation((selector) =>
      selector({
        isAuthenticated: false,
        isLoading: false,
      }),
    );

    await renderHook(() => useAuthGuard());

    expect(replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("does not redirect authenticated users", () => {
    mockedUseAuthStore.mockImplementation((selector) =>
      selector({
        isAuthenticated: true,
        isLoading: false,
      }),
    );

    renderHook(() => useAuthGuard());

    expect(replace).not.toHaveBeenCalled();
  });
});
