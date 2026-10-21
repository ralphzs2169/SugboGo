import { z } from "zod";

import { getExploreBusinessDetail } from "@/features/explore/api/exploreBusiness.service";
import { getBusinessPocketMemberships } from "@/features/pockets/api/pockets.service";
import { parsePocketMemberships } from "@/features/pockets/validation/pocketMemberships";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { OfflinePocketOperation } from "../types/offlinePockets.types";
import { createOfflineBusinessSnapshot } from "../validation/offlineBusinessSnapshot";
import {
  assertOfflinePocketWorkCurrent,
  completeOfflinePocketWork,
  failOfflinePocketWork,
  getOfflinePocketControl,
  invalidateOfflinePocketWork,
  publishOfflineBusinessSnapshot,
  startOfflinePocketWork,
} from "./offlinePockets.service";

const TRANSIENT_CODES = new Set([
  "NETWORK_ERROR",
  "REQUEST_TIMEOUT",
  "UNKNOWN_ERROR",
  "RATE_LIMIT_EXCEEDED",
]);

class InterruptedWorkError extends Error {}

function failureCode(error: unknown, interrupted: boolean): string {
  if (interrupted || error instanceof InterruptedWorkError) {
    return "INTERRUPTED";
  }
  if (error instanceof z.ZodError) {
    return "INVALID_RESPONSE";
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "CACHE_FAILED";
}

/** Non-envelope server errors (for example a proxy's HTML 502) are ambiguous, not removal. */
function responseData<T>(response: ApiResponse<T>): T {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.success !== "boolean"
  ) {
    throw {
      success: false,
      code: "UNKNOWN_ERROR",
      message: "Unexpected API response.",
    };
  }
  return throwOnApiError(response);
}

/** Backoff is durable via next_retry_at; attempts are capped at five per intention. */
export function offlinePocketRetryAt(
  attempts: number,
  now = Date.now(),
): number | null {
  return attempts < 5
    ? now + Math.min(300_000, 5_000 * 2 ** Math.max(0, attempts - 1))
    : null;
}

/** Runs a single claimed job. Only the singleton foreground coordinator schedules this function. */
export async function cacheOfflinePocketBusiness(
  operationInput: OfflinePocketOperation,
  canContinue: () => boolean,
  signal?: AbortSignal,
): Promise<void> {
  const operation = Object.freeze({ ...operationInput });
  // A failed claim belongs to another worker/revision; never mark its work failed.
  await startOfflinePocketWork(operation);
  const checkpoint = async () => {
    if (!canContinue() || signal?.aborted) {
      throw new InterruptedWorkError();
    }
    await assertOfflinePocketWorkCurrent(operation);
    if (!canContinue() || signal?.aborted) {
      throw new InterruptedWorkError();
    }
  };
  const hasMembership = async () => {
    await checkpoint();
    const response = await getBusinessPocketMemberships(
      operation.businessId,
      signal,
    );
    await checkpoint();
    const membership = parsePocketMemberships(
      responseData(response),
      operation.businessId,
    );
    if (!membership.is_pocketed) {
      await invalidateOfflinePocketWork(operation);
      return false;
    }
    return true;
  };
  try {
    if (!(await hasMembership())) {
      return;
    }
    await checkpoint();
    const response = await getExploreBusinessDetail(
      operation.businessId,
      signal,
    );
    const fetchedAt = new Date().toISOString();
    await checkpoint();
    const snapshot = createOfflineBusinessSnapshot(
      responseData(response),
      fetchedAt,
    );
    if (snapshot.business.id !== operation.businessId) {
      throw new Error("INVALID_BUSINESS_ID");
    }
    if (!(await hasMembership())) {
      return;
    }
    await checkpoint();
    await publishOfflineBusinessSnapshot(operation, snapshot);
    await checkpoint();
    await completeOfflinePocketWork(operation);
  } catch (error) {
    // This check also rejects revoked sessions, clearing and newer revisions.
    await assertOfflinePocketWorkCurrent(operation);
    const control = await getOfflinePocketControl(
      operation,
      operation.businessId,
    );
    const code = failureCode(error, !canContinue() || signal?.aborted === true);
    let retryAt: number | null = null;
    if (code === "INTERRUPTED") {
      retryAt = Date.now() + 5_000;
    } else if (TRANSIENT_CODES.has(code)) {
      retryAt = offlinePocketRetryAt(control?.attempts ?? 5);
    }
    await failOfflinePocketWork(
      operation,
      /^[A-Z0-9_]{1,64}$/.test(code) ? code : "CACHE_FAILED",
      retryAt,
    );
  }
}
