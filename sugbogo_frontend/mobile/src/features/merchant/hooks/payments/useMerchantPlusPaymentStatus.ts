import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";
import { useIsFocused } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import useMerchantPlusAccess from "../analytics/useMerchantPlusAccess";
import { merchantPlusReportScope } from "../analytics/merchantPlusAnalyticsQueryKeys";
import { merchantPlusPaymentState } from "../../utils/merchantPlusPayment";

export const PAYMENT_CHECK_LIMIT = 12;
export const PAYMENT_CHECK_INTERVAL = 5000;

/** Bounded foreground-only backend checks with account/session fencing and manual recovery. */
export default function useMerchantPlusPaymentStatus() {
  const access = useMerchantPlusAccess();
  const focused = useIsFocused();
  const client = useQueryClient();
  const generation = getAuthSessionGeneration();
  const [run, setRun] = useState(0);
  const [finishedRun, setFinishedRun] = useState<string | null>(null);
  const scope = `${access.accountId}:${generation}:${run}`;
  const { accountId, refetch } = access;

  useEffect(() => {
    if (!focused || !accountId) return;
    let cancelled = false;
    let stopped = false;
    let inFlight = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + PAYMENT_CHECK_LIMIT * PAYMENT_CHECK_INTERVAL;

    const check = async () => {
      if (cancelled || stopped || inFlight || !isAuthSessionCurrent(generation))
        return;
      if (AppState.currentState && AppState.currentState !== "active") return;
      if (attempts >= PAYMENT_CHECK_LIMIT || Date.now() >= deadline) {
        stopped = true;
        setFinishedRun(scope);
        return;
      }
      inFlight = true;
      attempts += 1;
      const result = await refetch({ cancelRefetch: false });
      inFlight = false;
      if (cancelled || !isAuthSessionCurrent(generation)) return;
      const state = merchantPlusPaymentState(result.data);
      if (result.error || !["checking", "activating"].includes(state)) {
        stopped = true;
        if (!result.error && state === "active") {
          void client.invalidateQueries({
            queryKey: merchantPlusReportScope(accountId),
          });
        }
        return;
      }
      if (attempts >= PAYMENT_CHECK_LIMIT) {
        stopped = true;
        setFinishedRun(scope);
        return;
      }
      timer = setTimeout(() => void check(), PAYMENT_CHECK_INTERVAL);
    };
    void check();
    const subscription = AppState.addEventListener("change", (state) => {
      clearTimeout(timer);
      if (state === "active") void check();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [accountId, generation, focused, run, refetch, client, scope]);

  const checkAgain = useCallback(() => setRun((value) => value + 1), []);
  return { ...access, exhausted: finishedRun === scope, checkAgain };
}
