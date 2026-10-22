import NetInfo from "@react-native-community/netinfo";
import { AppState, Platform } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";

import { OFFLINE_POCKETS_API_SCOPE } from "../constants/offlinePockets.constants";
import { cacheOfflinePocketBusiness } from "./offlinePocketWorker.service";
import {
  captureOfflinePocketContext,
  getOfflinePocketOperation,
  listOfflinePocketControls,
  recoverOfflinePocketWork,
  retryOfflinePocketWork,
} from "./offlinePockets.service";

let mounts = 0;
let active = false;
let online = false;
let epoch = 0;
let dirty = false;
let draining: Promise<void> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let detach: (() => void) | null = null;
let storageFailures = 0;
let activeController: AbortController | null = null;

function interrupt(): void {
  epoch += 1;
  activeController?.abort();
}

function ready(): boolean {
  const auth = useAuthStore.getState();
  return (
    mounts > 0 &&
    Platform.OS !== "web" &&
    active &&
    online &&
    auth.isAuthenticated &&
    !auth.isLoading &&
    !!auth.user?.id &&
    isAuthSessionCurrent(getAuthSessionGeneration())
  );
}

function sessionKey(): string {
  const auth = useAuthStore.getState();
  return JSON.stringify([
    OFFLINE_POCKETS_API_SCOPE,
    auth.user?.id,
    auth.isAuthenticated,
    auth.isLoading,
    getAuthSessionGeneration(),
  ]);
}

function clearTimer(): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule(at: number): void {
  clearTimer();
  if (ready()) {
    timer = setTimeout(
      requestOfflinePocketSync,
      Math.min(2_147_483_647, Math.max(0, at - Date.now())),
    );
  }
}

/** Coalesces wakeups; callers never control claims or perform downloads themselves. */
export function requestOfflinePocketSync(): void {
  dirty = true;
  clearTimer();
  if (draining || !ready()) {
    return;
  }
  draining = Promise.resolve()
    .then(async () => {
      while (dirty && ready()) {
        clearTimer();
        dirty = false;
        const startedEpoch = epoch;
        const controller = new AbortController();
        activeController = controller;
        const canContinue = () =>
          ready() && epoch === startedEpoch && !controller.signal.aborted;
        try {
          const context = await captureOfflinePocketContext();
          if (!canContinue()) {
            continue;
          }
          // The global drain survives unmount/session changes: no old job is still
          // executing here. Recovery invalidates persisted callbacks before claiming.
          await recoverOfflinePocketWork(context);
          const controls = await listOfflinePocketControls(context);
          for (const control of controls) {
            if (!canContinue()) {
              break;
            }
            const due =
              control.workStatus === "pending" ||
              (control.workStatus === "failed" &&
                control.nextRetryAt !== null &&
                control.nextRetryAt <= Date.now());
            if (!due || control.intent === "suppressed") {
              continue;
            }
            let operation = await getOfflinePocketOperation(
              context,
              control.businessId,
            );
            if (!operation || !canContinue()) {
              continue;
            }
            if (control.workStatus === "failed") {
              operation = await retryOfflinePocketWork(operation);
            }
            if (!canContinue()) {
              break;
            }
            try {
              await cacheOfflinePocketBusiness(
                operation,
                canContinue,
                controller.signal,
              );
            } catch {
              // Never lose a still-running job after a local write failure.
              // A later bounded pass recovers it, after this worker has settled.
              if (canContinue()) {
                throw new Error("Offline Pocket work did not settle.");
              }
            }
          }
          if (canContinue()) {
            const current = await listOfflinePocketControls(context);
            const retries = current.flatMap((row) =>
              row.workStatus === "failed" && row.nextRetryAt !== null
                ? [row.nextRetryAt]
                : [],
            );
            if (retries.length > 0) {
              schedule(Math.min(...retries));
            }
            storageFailures = 0;
          }
        } catch {
          // Local failures never loop continuously or toast over successful Pocket UI.
          storageFailures += 1;
          if (canContinue() && storageFailures <= 5) {
            schedule(
              Date.now() +
                Math.min(300_000, 5_000 * 2 ** (storageFailures - 1)),
            );
          }
        } finally {
          activeController = null;
        }
      }
    })
    .finally(() => {
      draining = null;
      if (dirty && ready()) {
        requestOfflinePocketSync();
      }
    });
}

/** Acquires the singleton lifecycle coordinator; duplicate mounts share listeners and one drain. */
export function mountOfflinePocketSync(): () => void {
  mounts += 1;
  if (mounts === 1) {
    active = AppState.currentState === "active";
    online = false;
    let key = sessionKey();
    let networkRevision = 0;
    let disposed = false;
    const authSubscription = useAuthStore.subscribe(() => {
      const nextKey = sessionKey();
      if (nextKey !== key) {
        key = nextKey;
        interrupt();
        storageFailures = 0;
        requestOfflinePocketSync();
      }
    });
    const appSubscription = AppState.addEventListener("change", (state) => {
      const next = state === "active";
      if (next !== active) {
        active = next;
        interrupt();
        requestOfflinePocketSync();
      }
    });
    const updateNetwork = (
      state: Awaited<ReturnType<typeof NetInfo.fetch>>,
    ) => {
      if (disposed) {
        return;
      }
      const next =
        state.isConnected === true && state.isInternetReachable !== false;
      if (next !== online) {
        online = next;
        interrupt();
        requestOfflinePocketSync();
      }
    };
    const networkSubscription = NetInfo.addEventListener((state) => {
      networkRevision += 1;
      updateNetwork(state);
    });
    void NetInfo.fetch()
      .then((state) => {
        if (!disposed && networkRevision === 0) {
          updateNetwork(state);
        }
      })
      .catch(() => undefined);
    detach = () => {
      disposed = true;
      authSubscription();
      appSubscription.remove();
      networkSubscription();
    };
    requestOfflinePocketSync();
  }
  let released = false;
  return () => {
    if (released) {
      return;
    }
    released = true;
    mounts -= 1;
    if (mounts === 0) {
      detach?.();
      detach = null;
      interrupt();
      active = false;
      online = false;
      clearTimer();
    }
  };
}
