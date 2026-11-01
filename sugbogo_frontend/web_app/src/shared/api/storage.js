/**
 * Utility functions for managing authentication tokens in local storage.
 * These functions provide a simple interface for getting, setting, and clearing access and refresh tokens.
 */

import queryClient from "@/lib/queryClient";
import { useAuthStore } from "@/features/auth/storage/auth.store";

let sessionGeneration = 0;
let sessionOwner;
let sessionAvailable;
let sessionController = new AbortController();
const sessionListeners = new Set();
const SESSION_OWNER_KEY = "auth_session_id";

/** Discard protected state before any response from another session can be consumed. */
function resetSessionState() {
  sessionGeneration += 1;
  sessionController.abort();
  sessionController = new AbortController();
  queryClient.clear();
  useAuthStore.getState().clearUser();
}

/** Reconcile ownership from storage without broadcasting credentials or rewriting another tab's tokens. */
function reconcileSession() {
  const owner = localStorage.getItem(SESSION_OWNER_KEY);
  const available = Boolean(getAccessToken());
  if (sessionOwner === undefined) {
    sessionOwner = owner;
    sessionAvailable = available;
    return;
  }
  if (owner === sessionOwner && available === sessionAvailable) return;

  sessionOwner = owner;
  sessionAvailable = available;
  resetSessionState();
  useAuthStore.getState().setLoading(available);
  sessionListeners.forEach((listener) => listener());
}

/** Observe external login/logout and resume events; same-session token rotation keeps its owner. */
export function subscribeToSessionChanges(listener) {
  reconcileSession();
  sessionListeners.add(listener);
  function onStorage(event) {
    if (event.storageArea && event.storageArea !== localStorage) return;
    if ([null, SESSION_OWNER_KEY, "access_token", "refresh_token"].includes(event.key)) {
      reconcileSession();
    }
  }
  window.addEventListener("storage", onStorage);
  window.addEventListener("focus", reconcileSession);
  return () => {
    sessionListeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("focus", reconcileSession);
  };
}

/** Identifies the current tab's login without changing during token rotation. */
export function getSessionGeneration() {
  reconcileSession();
  return sessionGeneration;
}

/** Cancel protected transports together when their owning session ends. */
export function getSessionSignal() {
  reconcileSession();
  return sessionController.signal;
}

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

export function setTokens({ access, refresh }, { preserveSession = false } = {}) {
  if (!preserveSession) {
    resetSessionState();
    sessionOwner = crypto.randomUUID();
  }
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  sessionAvailable = true;
  if (!preserveSession) {
    localStorage.setItem(SESSION_OWNER_KEY, sessionOwner);
  }
}

export function clearTokens() {
  resetSessionState();
  useAuthStore.getState().setLoading(false);
  sessionOwner = null;
  sessionAvailable = false;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem(SESSION_OWNER_KEY);
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
