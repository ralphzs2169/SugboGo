import { useMutation } from "@tanstack/react-query";
import { useLayoutEffect, useRef } from "react";

import {
  recordBusinessImpressions,
  recordBusinessProfileVisit,
} from "../api/exploreBusiness.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import type { DiscoverySource } from "../constants/discoverySources";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import {
  getAuthSessionGeneration,
  subscribeAuthSessionChanges,
} from "@/shared/api/authSessionGeneration.service";

/** Return a safe retry delay only for recoverable visibility-delivery errors. */
function visibilityRetryDelay(error: unknown): number | null {
  const { code, retry_after: retryAfter } = (error ?? {}) as {
    code?: string;
    retry_after?: unknown;
  };

  if (code === "NETWORK_ERROR" || code === "REQUEST_TIMEOUT") {
    return 1000;
  }
  if (code !== "VISIBILITY_TRACKING_UNAVAILABLE") {
    return null;
  }

  // Older servers without timing metadata cannot promise recovery after a delay.
  if (
    typeof retryAfter !== "number" ||
    !Number.isFinite(retryAfter) ||
    retryAfter < 0
  ) {
    return null;
  }
  const delay = Math.max(1000, Math.ceil(retryAfter * 1000));
  // Oversized native timers can wrap to an immediate retry; never shorten a server wait.
  return delay <= 2147483647 ? delay : null;
}

/** Wait once, clearing the timer and listener when the delivery lifecycle ends. */
function waitForVisibilityRetry(
  milliseconds: number,
  signal: AbortSignal,
  error: unknown,
) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) {
      reject(error);
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(error);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

/** Keep delivery in React Query with one lifecycle-cancellable retry, never a paused queue. */
function useVisibilityMutation<TInput, TOutput>(
  deliver: (input: TInput) => Promise<ApiResponse<TOutput>>,
) {
  const lifecycle = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    lifecycle.current = new AbortController();
    const unsubscribe = subscribeAuthSessionChanges(() => {
      lifecycle.current?.abort();
      lifecycle.current = new AbortController();
    });
    return () => {
      unsubscribe();
      lifecycle.current?.abort();
      lifecycle.current = null;
    };
  }, []);

  return useMutation({
    mutationFn: async (input: TInput) => {
      const signal = lifecycle.current?.signal;
      const generation = getAuthSessionGeneration();
      try {
        return throwOnApiError(await deliver(input));
      } catch (error) {
        const delay = visibilityRetryDelay(error);
        if (
          delay === null ||
          !signal ||
          signal.aborted ||
          generation !== getAuthSessionGeneration()
        ) {
          throw error;
        }

        await waitForVisibilityRetry(delay, signal, error);
        if (signal.aborted || generation !== getAuthSessionGeneration()) {
          throw error;
        }
        return throwOnApiError(await deliver(input));
      }
    },
    // TanStack's mutation retry sleep cannot be cancelled on observer unmount.
    retry: false,
    networkMode: "always",
    throwOnError: false,
  });
}

/** Submit qualified impression batches without changing cache or UI error behavior. */
export function useRecordBusinessImpressions() {
  return useVisibilityMutation(recordBusinessImpressions);
}

type ProfileVisit =
  number | { businessId: number; discoverySource: DiscoverySource };

/** Preserve the originally reported business and source across the bounded retry. */
async function deliverProfileVisit(visit: ProfileVisit) {
  if (typeof visit === "number") {
    return recordBusinessProfileVisit(visit);
  }
  return recordBusinessProfileVisit(visit.businessId, visit.discoverySource);
}

/** Submit displayed profile visits through the same bounded delivery lifecycle. */
export function useRecordBusinessProfileVisit() {
  return useVisibilityMutation(deliverProfileVisit);
}
