import NetInfo from "@react-native-community/netinfo";

import { getBusinessPocketMemberships } from "@/features/pockets/api/pockets.service";
import { parsePocketMemberships } from "@/features/pockets/validation/pocketMemberships";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import type { OfflinePocketOperation } from "../types/offlinePockets.types";
import {
  applyOfflinePocketMembershipChange,
  captureOfflinePocketContext,
  getOfflinePocketControl,
  requestOfflinePocketRestore,
  retryOfflinePocketWork,
} from "./offlinePockets.service";
import { requestOfflinePocketSync } from "./offlinePocketSync.service";
import { notifyOfflineSnapshotsChanged } from "./offlinePocketSnapshots.events";

export class OfflineStorageActionError extends Error {}

async function requireInternet(): Promise<void> {
  const state = await NetInfo.fetch();
  if (state.isConnected !== true || state.isInternetReachable === false) {
    throw new OfflineStorageActionError(
      "Connect to the internet to download businesses.",
    );
  }
}

/** A deliberate per-business action, captured before any connectivity or backend wait. */
export async function makeBusinessAvailableOffline(
  businessId: number,
): Promise<void> {
  const context = await captureOfflinePocketContext();
  const previous = await getOfflinePocketControl(context, businessId);
  await requireInternet();
  const memberships = parsePocketMemberships(
    throwOnApiError(await getBusinessPocketMemberships(businessId)),
    businessId,
  );
  if (!memberships.is_pocketed) {
    await applyOfflinePocketMembershipChange(
      context,
      businessId,
      previous?.operationVersion ?? null,
      true,
      false,
    );
    throw new OfflineStorageActionError(
      "This business is no longer saved in My Pockets.",
    );
  }
  // CAS rejects removals/new saves that settled during membership verification.
  await requestOfflinePocketRestore(
    context,
    businessId,
    previous?.operationVersion ?? null,
  );
  requestOfflinePocketSync();
}

/** Retries only pinned, due retryable work. Never restores suppressed or permanently failed entries. */
export async function retryOfflineBusinessDownloads(
  operationsInput: readonly OfflinePocketOperation[],
): Promise<number> {
  const operations = operationsInput.map((operation) =>
    Object.freeze({ ...operation }),
  );
  await requireInternet();
  let queued = 0;
  try {
    for (const operation of operations) {
      // Fail before issuing a request if the captured account/clear generation was revoked.
      const current = await getOfflinePocketControl(
        operation,
        operation.businessId,
      );
      if (
        current?.operationVersion !== operation.operationVersion ||
        current.intent === "suppressed" ||
        current.workStatus !== "failed" ||
        current.nextRetryAt === null ||
        current.nextRetryAt > Date.now()
      )
        continue;
      const memberships = parsePocketMemberships(
        throwOnApiError(
          await getBusinessPocketMemberships(operation.businessId),
        ),
        operation.businessId,
      );
      if (!memberships.is_pocketed) {
        await applyOfflinePocketMembershipChange(
          operation,
          operation.businessId,
          operation.operationVersion,
          true,
          false,
        );
        continue;
      }
      await retryOfflinePocketWork(operation);
      queued += 1;
    }
    return queued;
  } finally {
    if (queued) requestOfflinePocketSync();
    notifyOfflineSnapshotsChanged();
  }
}
