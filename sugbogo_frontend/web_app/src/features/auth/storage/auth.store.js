import { create } from "zustand";

/**
 * Zustand store for authentication state management.
 */
export const useAuthStore = create((set) => ({
  user: null,

  isAuthenticated: false,

  isLoading: true,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: true,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),

  clearUser: () =>
    set({
      user: null,
      isAuthenticated: false,
    }),
}));
