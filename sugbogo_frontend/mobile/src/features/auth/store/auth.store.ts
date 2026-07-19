import { create } from "zustand";
import { User } from "../api/auth.types";

/**
 * Global authentication store.
 *
 * Manages the authenticated user's session state throughout the application,
 * including the current user information and authentication status.
 */

interface AuthState {
  /**
   * The currently authenticated user.
   * Null when no user is logged in.
   */
  user: User | null;

  /**
   * Indicates whether the user is currently authenticated.
   */
  isAuthenticated: boolean;

  /**
   * Indicates whether the authentication system is currently
   * restoring or initializing the user's session.
   */
  isLoading: boolean;

  /**
   * True while the user is actively signing in.
   */
  isSigningIn: boolean;

  /**
   * Updates the authenticated user and marks the session as authenticated.
   * @param {User} user - The authenticated user's information.
   */
  setUser: (user: User) => void;

  /**
   * Updates the authentication loading state.
   * @param {boolean} loading - Whether authentication is currently being initialized.
   */
  setLoading: (loading: boolean) => void;

  setSigningIn: (loading: boolean) => void;

  /**
   * Clears the authenticated user and resets the authentication state.
   */
  clearUser: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,

  isAuthenticated: false,

  isLoading: true,

  isSigningIn: false,

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),
  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
    }),

  setSigningIn: (loading) =>
    set({
      isSigningIn: loading,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
