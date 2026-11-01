/**
 * Utility functions for managing authentication tokens in local storage.
 * These functions provide a simple interface for getting, setting, and clearing access and refresh tokens.
 */

import queryClient from "@/lib/queryClient";

let sessionGeneration = 0;

/** Identifies the current tab's login without changing during token rotation. */
export function getSessionGeneration() {
  return sessionGeneration;
}

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

export function setTokens({ access, refresh }, { preserveSession = false } = {}) {
  if (!preserveSession) {
    sessionGeneration += 1;
    // Cancel in-flight reads and discard all prior account data before a new login.
    queryClient.clear();
  }
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  sessionGeneration += 1;
  queryClient.clear();
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

const SESSION_EXPIRED_KEY = "session_expired";

export function setSessionExpired() {
  sessionStorage.setItem(SESSION_EXPIRED_KEY, "true");
}

export function getSessionExpired() {
  return sessionStorage.getItem(SESSION_EXPIRED_KEY) === "true";
}

export function clearSessionExpired() {
  sessionStorage.removeItem(SESSION_EXPIRED_KEY);
}
