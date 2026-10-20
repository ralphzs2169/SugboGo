import { useAuthStore } from "../auth.store";
import type { User } from "@/features/users/types/user.types";

const user: User = {
  id: 1,
  email: "test@test.com",
  first_name: "Test",
  last_name: "Explorer",
  gender: null,
  role: "explorer",
  status: "active",
  has_completed_interest_selection: false,
  has_custom_profile_picture: false,
  has_oauth_accounts: false,
};

/**
 * @file auth.store.test.ts
 * @description Unit tests for the authentication Zustand store.
 *
 * Verifies that authentication state is correctly initialized,
 * updated when a user logs in, cleared on logout, and that loading
 * state changes correctly during session restoration.
 *
 * Run:
 * npm test -- auth.store.test.ts
 */

describe("auth.store", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });
  });

  it("starts with unauthenticated state", () => {
    const state = useAuthStore.getState();

    expect(state.user).toBeNull();

    expect(state.isAuthenticated).toBe(false);

    expect(state.isLoading).toBe(true);
  });

  it("sets authenticated user", () => {
    useAuthStore.getState().setUser(user);

    const state = useAuthStore.getState();

    expect(state.user).toEqual(user);

    expect(state.isAuthenticated).toBe(true);
  });

  it("clears authenticated user", () => {
    useAuthStore.setState({
      user,
      isAuthenticated: true,
    });

    useAuthStore.getState().clearUser();

    const state = useAuthStore.getState();

    expect(state.user).toBeNull();

    expect(state.isAuthenticated).toBe(false);
  });

  it("updates loading state", () => {
    useAuthStore.getState().setLoading(false);

    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
