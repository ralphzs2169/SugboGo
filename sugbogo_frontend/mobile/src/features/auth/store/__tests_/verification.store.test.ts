import AsyncStorage from "@react-native-async-storage/async-storage";
import { act } from "@testing-library/react-native";

import { useVerificationStore } from "../verification.store";

/**
 * @file verification.store.test.ts
 * @description Unit tests for the email verification Zustand store.
 *
 * Verifies:
 *
 * - pending email can be stored
 * - pending email can be cleared
 * - store persists data using AsyncStorage
 *
 * Run:
 * npm test -- verification.store.test.ts
 */

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe("verification store", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    useVerificationStore.setState({
      pendingEmail: null,
    });
  });

  it("sets pending email", () => {
    const store = useVerificationStore.getState();

    store.setPendingEmail("test@test.com");

    expect(useVerificationStore.getState().pendingEmail).toBe("test@test.com");
  });

  it("clears pending email", () => {
    const store = useVerificationStore.getState();

    store.setPendingEmail("test@test.com");

    store.clearPendingEmail();

    expect(useVerificationStore.getState().pendingEmail).toBeNull();
  });

  it("persists pending email using AsyncStorage", async () => {
    await act(async () => {
      useVerificationStore.getState().setPendingEmail("test@test.com");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});
