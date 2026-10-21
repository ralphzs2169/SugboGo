import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { getMerchantAnalyticsPdf } from "../../api/merchantAnalyticsExport.service";
import { shareMerchantAnalyticsPdf } from "../../utils/merchantAnalyticsExportFile";
import type { MerchantAnalyticsPeriod } from "../../types/merchantAnalytics.types";
import { denyMerchantPlusAccess } from "./useMerchantPlusAccess";

/** Keeps explicit exports uncached and prevents late files from crossing account or screen boundaries. */
export default function useMerchantAnalyticsExport(enabled: boolean) {
  const accountId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const active = useRef(enabled);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = enabled;
    if (!enabled) controller.current?.abort();
    return () => {
      active.current = false;
      controller.current?.abort();
    };
  }, [enabled, accountId]);
  const mutation = useMutation({
    mutationKey: ["merchant-analytics-export", accountId],
    gcTime: 0,
    networkMode: "always",
    retry: false,
    mutationFn: async (variables: {
      period: MerchantAnalyticsPeriod;
      accountId: number;
      generation: number;
      controller: AbortController;
    }) => {
      const assertCurrent = () => {
        if (
          !active.current ||
          variables.controller.signal.aborted ||
          useAuthStore.getState().user?.id !== variables.accountId ||
          !isAuthSessionCurrent(variables.generation)
        ) {
          throw new Error(
            "Export cancelled because the active session changed.",
          );
        }
      };
      assertCurrent();
      const response = await getMerchantAnalyticsPdf(
        variables.period,
        variables.controller.signal,
      );
      assertCurrent();
      if (!response.success && response.code === "PLUS_REQUIRED") {
        denyMerchantPlusAccess(client, variables.accountId);
      }
      const pdf = throwOnApiError(response);
      await shareMerchantAnalyticsPdf(pdf, assertCurrent);
    },
    onSettled: () => {
      pending.current = false;
      controller.current = null;
    },
  });
  return {
    ...mutation,
    error: mutation.variables?.accountId === accountId ? mutation.error : null,
    exportPdf: (period: MerchantAnalyticsPeriod) => {
      if (!enabled || !accountId || pending.current) return;
      pending.current = true;
      controller.current = new AbortController();
      mutation.mutate({
        period,
        accountId,
        generation: getAuthSessionGeneration(),
        controller: controller.current,
      });
    },
  };
}
