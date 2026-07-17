/**
 * @file useLogin.test.ts
 * @description Unit tests for the useLogin authentication hook.
 *
 * Verifies:
 *
 * - successful login establishes a user session
 *
 * - backend login errors are returned correctly
 *
 * - unexpected errors return a generic failure response
 *
 * - loading state updates during authentication
 *
 * Run:
 * npm test -- useLogin.test.ts
 */

import { act, renderHook } from "@testing-library/react-native";
import axios from "axios";

import { useLogin } from "../useLogin";

import { login } from "@/features/auth/api/auth.service";
import { establishSession } from "@/features/auth/utils/authSession";
import { useVerificationStore } from "../../store/verification.store";

jest.mock("@/features/auth/api/auth.service", () => ({
  login: jest.fn(),
}));

jest.mock("@/features/auth/utils/authSession", () => ({
  establishSession: jest.fn(),
}));

jest.mock("../../store/verification.store", () => ({
  useVerificationStore: jest.fn(),
}));

jest.mock("axios", () => ({
  isAxiosError: jest.fn(),
}));

const mockedLogin = login as jest.Mock;
const mockedEstablishSession = establishSession as jest.Mock;

const mockedIsAxiosError = axios.isAxiosError as unknown as jest.Mock;

const mockedClearPendingEmail = jest.fn();

describe("useLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useVerificationStore as unknown as jest.Mock).mockImplementation(
      (selector) =>
        selector({
          clearPendingEmail: mockedClearPendingEmail,
        }),
    );
  });

  it("logs in successfully and establishes session", async () => {
    const response = {
      access: "access-token",
      refresh: "refresh-token",
      user: {
        id: 1,
        email: "test@test.com",
        role: "EXPLORER",
        status: "ACTIVE",
        has_completed_interest_selection: false,
      },
    };

    mockedLogin.mockResolvedValue(response);

    const { result } = await renderHook(() => useLogin());

    let loginResult;

    await act(async () => {
      loginResult = await result.current.handleLogin(
        "test@test.com",
        "Password123!",
      );
    });

    expect(loginResult).toEqual({
      success: true,
      data: response,
    });

    expect(mockedLogin).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "Password123!",
    });

    expect(mockedEstablishSession).toHaveBeenCalledWith(response);

    expect(mockedClearPendingEmail).toHaveBeenCalled();

    expect(result.current.loading).toBe(false);
  });

  it("returns backend errors when login fails", async () => {
    const backendError = {
      response: {
        data: {
          email: ["Invalid email."],
        },
      },
    };

    mockedLogin.mockRejectedValue(backendError);

    mockedIsAxiosError.mockReturnValue(true);

    const { result } = await renderHook(() => useLogin());

    let loginResult;

    await act(async () => {
      loginResult = await result.current.handleLogin(
        "wrong@test.com",
        "wrong-password",
      );
    });

    expect(loginResult).toEqual({
      success: false,
      errors: {
        email: ["Invalid email."],
      },
    });

    expect(mockedEstablishSession).not.toHaveBeenCalled();

    expect(mockedClearPendingEmail).not.toHaveBeenCalled();
  });

  it("returns generic error when unknown error occurs", async () => {
    mockedLogin.mockRejectedValue(new Error("Network error"));

    mockedIsAxiosError.mockReturnValue(false);

    const { result } = await renderHook(() => useLogin());

    let loginResult;

    await act(async () => {
      loginResult = await result.current.handleLogin(
        "test@test.com",
        "Password123!",
      );
    });

    expect(loginResult).toEqual({
      success: false,
      errors: {
        password: ["Something went wrong. Please try again."],
      },
    });
  });

  it("sets loading state during login", async () => {
    let resolveLogin: ((value: unknown) => void) | undefined;

    mockedLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        }),
    );

    const { result } = await renderHook(() => useLogin());

    let loginPromise: Promise<any>;

    await act(async () => {
      loginPromise = result.current.handleLogin(
        "test@test.com",
        "Password123!",
      );
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveLogin?.({
        access: "access-token",
        refresh: "refresh-token",
        user: {},
      });

      await loginPromise;
    });

    expect(result.current.loading).toBe(false);
  });
});
