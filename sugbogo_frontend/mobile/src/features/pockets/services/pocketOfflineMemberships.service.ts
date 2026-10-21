import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { OFFLINE_POCKETS_API_SCOPE } from "@/features/offline-pockets/constants/offlinePockets.constants";
import type {
  OfflinePocketContext,
  OfflinePocketControl,
} from "@/features/offline-pockets/types/offlinePockets.types";
import {
  applyOfflinePocketMembershipChange,
  captureOfflinePocketContext,
  getOfflinePocketControl,
  listOfflinePocketControls,
  StaleOfflinePocketOperationError,
} from "@/features/offline-pockets/services/offlinePockets.service";
import { requestOfflinePocketSync } from "@/features/offline-pockets/services/offlinePocketSync.service";

import {
  deletePocketCollection,
  getBusinessPocketMemberships,
  removePocketCollectionBusiness,
  replaceBusinessPocketMemberships,
} from "../api/pockets.service";
import { parsePocketMemberships } from "../validation/pocketMemberships";

export type PocketOfflineChange = Readonly<{
  ownerId: number;
  generation: number;
  apiScope: string;
  context: Promise<OfflinePocketContext | null>;
}>;

const queues = new Map<string, Promise<void>>();

function isCurrent(change: PocketOfflineChange): boolean {
  const auth = useAuthStore.getState();
  return (
    auth.isAuthenticated &&
    !auth.isLoading &&
    auth.user?.id === change.ownerId &&
    OFFLINE_POCKETS_API_SCOPE === change.apiScope &&
    isAuthSessionCurrent(change.generation)
  );
}

/** Capture before React Query's asynchronous onMutate work, never in a delayed success callback. */
export function preparePocketOfflineChange(
  ownerId: number,
  generation = getAuthSessionGeneration(),
): PocketOfflineChange {
  const context = captureOfflinePocketContext().catch(() => null);
  return Object.freeze({
    ownerId,
    generation,
    apiScope: OFFLINE_POCKETS_API_SCOPE,
    context,
  });
}

function ambiguous(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return true;
  }
  const code =
    "code" in error ? error.code : error instanceof Error ? error.name : null;
  return (
    code === "NETWORK_ERROR" ||
    code === "REQUEST_TIMEOUT" ||
    code === "UNKNOWN_ERROR"
  );
}

function membership(data: unknown, businessId: number) {
  try {
    return parsePocketMemberships(data, businessId);
  } catch {
    return null;
  }
}

async function readMembership(change: PocketOfflineChange, businessId: number) {
  if (!isCurrent(change)) {
    return null;
  }
  try {
    const response = await getBusinessPocketMemberships(businessId);
    return isCurrent(change) && response.success
      ? membership(response.data, businessId)
      : null;
  } catch {
    return null;
  }
}

async function ownedContext(change: PocketOfflineChange) {
  const context = await change.context;
  return isCurrent(change) &&
    context?.ownerId === change.ownerId &&
    context.sessionGeneration === change.generation &&
    context.apiScope === change.apiScope
    ? context
    : null;
}

/** Acknowledges the backend before local work, but orders later membership writes after reconciliation. */
function runChange<TLocal, TData>(
  change: PocketOfflineChange,
  prepare: () => Promise<TLocal | null>,
  request: () => Promise<ApiResponse<TData>>,
  reconcile: (local: TLocal, data: TData | null) => Promise<void>,
): Promise<ApiResponse<TData>> {
  const key = JSON.stringify([
    change.apiScope,
    change.ownerId,
    change.generation,
  ]);
  return new Promise((resolve, reject) => {
    const task = (queues.get(key) ?? Promise.resolve()).then(async () => {
      try {
        if (!isCurrent(change)) {
          throw new Error("Your Pocket session changed.");
        }
        let local: TLocal | null = null;
        try {
          local = await prepare();
        } catch {
          // SQLite availability cannot reject an otherwise valid backend mutation.
        }
        if (!isCurrent(change)) {
          throw new Error("Your Pocket session changed.");
        }
        const reconcileSafely = async (data: TData | null) => {
          if (local === null || !isCurrent(change)) {
            return;
          }
          try {
            await reconcile(local, data);
          } catch {
            // A failed local cache update never becomes a Pocket mutation error.
          }
        };
        let response: ApiResponse<TData>;
        try {
          response = await request();
        } catch (error) {
          reject(error);
          if (ambiguous(error)) {
            await reconcileSafely(null);
          }
          return;
        }
        resolve(response);
        if (response.success || ambiguous(response)) {
          await reconcileSafely(response.success ? response.data : null);
        }
      } catch (error) {
        // Session/request setup failures still follow the ordinary mutation path.
        reject(error);
      }
    });
    queues.set(key, task);
    void task.then(() => {
      if (queues.get(key) === task) {
        queues.delete(key);
      }
    });
  });
}

type BusinessChange = {
  context: OfflinePocketContext;
  version: number | null;
  wasSaved: boolean | null;
};

async function removeConfirmedBusiness(
  change: PocketOfflineChange,
  businessId: number,
  local: BusinessChange,
): Promise<void> {
  try {
    await applyOfflinePocketMembershipChange(
      local.context,
      businessId,
      local.version,
      null,
      false,
    );
  } catch (error) {
    if (!(error instanceof StaleOfflinePocketOperationError)) {
      throw error;
    }
    // Retry/recovery can advance a job during the backend mutation. Never reuse
    // the older response against that revision: pin it and read membership again.
    // The original context still rejects any intervening account clear/session end.
    const current = await getOfflinePocketControl(local.context, businessId);
    if (!current || current.intent === "suppressed") {
      return;
    }
    const confirmed = await readMembership(change, businessId);
    if (confirmed?.is_pocketed === false && isCurrent(change)) {
      await applyOfflinePocketMembershipChange(
        local.context,
        businessId,
        current.operationVersion,
        null,
        false,
      );
    }
  }
}

async function prepareBusiness(
  change: PocketOfflineChange,
  businessId: number,
  readPrevious: boolean,
): Promise<BusinessChange | null> {
  const context = await ownedContext(change);
  if (!context) {
    return null;
  }
  const control = await getOfflinePocketControl(context, businessId);
  const previous = readPrevious
    ? await readMembership(change, businessId)
    : null;
  return {
    context,
    version: control?.operationVersion ?? null,
    wasSaved: previous?.is_pocketed ?? null,
  };
}

async function reconcileBusiness(
  change: PocketOfflineChange,
  businessId: number,
  local: BusinessChange,
  data: unknown,
): Promise<void> {
  const confirmed =
    membership(data, businessId) ?? (await readMembership(change, businessId));
  if (!confirmed || !isCurrent(change)) {
    return;
  }
  if (!confirmed.is_pocketed) {
    await removeConfirmedBusiness(change, businessId, local);
    return;
  }
  const enqueued = await applyOfflinePocketMembershipChange(
    local.context,
    businessId,
    local.version,
    local.wasSaved,
    confirmed.is_pocketed,
  );
  if (enqueued) {
    requestOfflinePocketSync();
  }
}

/** Only a freshly observed aggregate false -> true transition may bypass suppression. */
export function replacePocketMembershipsWithOffline(
  change: PocketOfflineChange,
  businessId: number,
  pocketIds: number[],
) {
  const selection = [...pocketIds];
  return runChange(
    change,
    () => prepareBusiness(change, businessId, true),
    () => replaceBusinessPocketMemberships(businessId, selection),
    (local, data) => reconcileBusiness(change, businessId, local, data),
  );
}

/** Removal cannot create a new aggregate save; remaining memberships preserve the cache policy. */
export function removePocketBusinessWithOffline(
  change: PocketOfflineChange,
  collectionId: number,
  businessId: number,
) {
  return runChange(
    change,
    () => prepareBusiness(change, businessId, false),
    () => removePocketCollectionBusiness(collectionId, businessId),
    (local, data) => reconcileBusiness(change, businessId, local, data),
  );
}

/** Checks all eligible local identities, independent of which collection pages are loaded. */
export function deletePocketCollectionWithOffline(
  change: PocketOfflineChange,
  collectionId: number,
) {
  return runChange(
    change,
    async () => {
      const context = await ownedContext(change);
      if (!context) {
        return null;
      }
      const controls = await listOfflinePocketControls(context);
      return {
        context,
        controls: controls.filter((row) => row.intent !== "suppressed"),
      };
    },
    () => deletePocketCollection(collectionId),
    async ({ context, controls }) => {
      // Stop a stale clear generation before issuing a batch of membership reads.
      await listOfflinePocketControls(context);
      let cursor = 0;
      await Promise.all(
        [0, 1].map(async () => {
          while (cursor < controls.length && isCurrent(change)) {
            const tracked = controls[cursor++];
            let control: OfflinePocketControl | null;
            try {
              control = await getOfflinePocketControl(
                context,
                tracked.businessId,
              );
            } catch {
              // Stop this batch after clearing, session revocation or database failure.
              return;
            }
            if (!control || control.intent === "suppressed") {
              continue;
            }
            const confirmed = await readMembership(change, control.businessId);
            if (confirmed?.is_pocketed === false && isCurrent(change)) {
              try {
                await removeConfirmedBusiness(change, control.businessId, {
                  context,
                  version: control.operationVersion,
                  wasSaved: null,
                });
              } catch {
                // A newer revision, clearing or local failure cannot justify deleting newer data.
              }
            }
          }
        }),
      );
    },
  );
}
