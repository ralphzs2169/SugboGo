import { create } from "zustand";

/**
 * Zustand store for authentication state management.
 */
export const useAuthStore = create((set) => ({
  user: null,

  isAuthenticated: false,

  isLoading: true,

  sessionExpired: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),

  setSessionExpired: (sessionExpired) =>
    set({
      sessionExpired,
    }),

  clearSessionExpired: () =>
    set({
      sessionExpired: false,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
