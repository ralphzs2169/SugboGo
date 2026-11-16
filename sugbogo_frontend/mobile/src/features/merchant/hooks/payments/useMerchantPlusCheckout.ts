import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "@/features/auth/store/auth.store";
import {
  getAuthSessionGeneration,
  isAuthSessionCurrent,
} from "@/shared/api/authSessionGeneration.service";
import { throwOnApiError } from "@/shared/utils/throwOnApiError";
import { createMerchantPlusCheckout } from "../../api/merchantPlusCheckout.service";
import { merchantPlusStatusKey } from "../analytics/merchantPlusAnalyticsQueryKeys";
import { isMayaSandboxCheckoutUrl } from "../../utils/merchantPlusPayment";

let openingCheckout = false;

/** Serializes explicit purchase taps and fences browser/navigation effects to the current session. */
export default function useMerchantPlusCheckout() {
  const accountId = useAuthStore((state) => state.user?.id);
  const generation = getAuthSessionGeneration();
  const client = useQueryClient();
  const active = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const stopWatchingBrowser = useRef<(() => void) | null>(null);
  const scope = `${accountId}:${generation}`;
  const [progress, setProgress] = useState<{
    scope: string;
    phase: "idle" | "preparing" | "opening";
  }>({ scope, phase: "idle" });
  const phase = progress.scope === scope ? progress.phase : "idle";
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controller.current?.abort();
      stopWatchingBrowser.current?.();
    };
  }, [accountId, generation]);
  const mutation = useMutation({
    mutationKey: ["merchant-plus-checkout", accountId, generation],
    retry: false,
    networkMode: "always",
    gcTime: 0,
    mutationFn: async (operation: {
      accountId: number;
      generation: number;
    }) => {
      const operationScope = `${operation.accountId}:${operation.generation}`;
      const current = () =>
        active.current &&
        isAuthSessionCurrent(operation.generation) &&
        useAuthStore.getState().user?.id === operation.accountId;
      if (!current()) {
        openingCheckout = false;
        return;
      }
      controller.current = new AbortController();
      try {
        const checkout = throwOnApiError(
          await createMerchantPlusCheckout(controller.current.signal),
        );
        if (!current()) return;
        if (checkout.next_action === "open_checkout") {
          if (
            checkout.provider !== "maya" ||
            checkout.mode !== "test" ||
            !isMayaSandboxCheckoutUrl(checkout.checkout_url)
          ) {
            throw new Error("Checkout could not be opened safely.");
          }
          setProgress({ scope: operationScope, phase: "opening" });
          stopWatchingBrowser.current?.();
          if (Platform.OS === "android") {
            // Android resolves when the custom tab opens, before it closes.
            let leftApp = AppState.currentState === "background";
            const subscription = AppState.addEventListener(
              "change",
              (state) => {
                if (state === "background") leftApp = true;
                if (state !== "active" || !leftApp) return;
                stopWatching();
                if (!current()) return;
                void client.invalidateQueries({
                  queryKey: merchantPlusStatusKey(operation.accountId),
                });
              },
            );
            const stopWatching = () => {
              subscription.remove();
              stopWatchingBrowser.current = null;
            };
            stopWatchingBrowser.current = stopWatching;
          }
          try {
            // Resume the existing activity on Back instead of relaunching its intent.
            await WebBrowser.openBrowserAsync(checkout.checkout_url, {
              createTask: false,
            });
          } catch (error) {
            stopWatchingBrowser.current?.();
            throw error;
          }
          return;
        }
        router.replace("/(merchant)/merchant-plus/return");
      } finally {
        openingCheckout = false;
        if (current()) {
          void client.invalidateQueries({
            queryKey: merchantPlusStatusKey(operation.accountId),
          });
          setProgress({ scope: operationScope, phase: "idle" });
        }
      }
    },
  });
  const startCheckout = () => {
    if (
      !accountId ||
      !active.current ||
      !isAuthSessionCurrent(generation) ||
      openingCheckout
    )
      return;
    openingCheckout = true;
    setProgress({ scope, phase: "preparing" });
    mutation.mutate({ accountId, generation });
  };
  return {
    startCheckout,
    phase,
    busy: phase !== "idle",
    error:
      mutation.variables?.accountId === accountId &&
      mutation.variables?.generation === generation
        ? mutation.error
        : null,
  };
}
