import { useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useAuthStore } from "@/features/auth/store/auth.store";

import { notificationKeys } from "./notificationQueryKeys";

const RESUME_DEBOUNCE_MS = 2_000;

/** Refreshes active inbox queries after tab focus and foreground resumes. */
export function useNotificationRefreshLifecycle() {
  const userId = useAuthStore((state) => state.user?.id);
  const queryClient = useQueryClient();
  const hasFocusedOnce = useRef(false);
  const isScreenFocused = useRef(false);
  const lastRefreshAt = useRef(0);

  const refresh = useCallback(() => {
    if (!userId) {
      return;
    }

    lastRefreshAt.current = Date.now();
    void queryClient.invalidateQueries({
      queryKey: notificationKeys.account(userId),
      refetchType: "active",
    });
  }, [queryClient, userId]);

  useFocusEffect(
    useCallback(() => {
      isScreenFocused.current = true;

      if (hasFocusedOnce.current) {
        refresh();
      } else {
        hasFocusedOnce.current = true;
      }

      return () => {
        isScreenFocused.current = false;
      };
    }, [refresh]),
  );

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const isResume =
        nextState === "active" && /inactive|background/.test(previousState);
      previousState = nextState;

      if (
        isResume &&
        isScreenFocused.current &&
        Date.now() - lastRefreshAt.current > RESUME_DEBOUNCE_MS
      ) {
        refresh();
      }
    });

    return () => subscription.remove();
  }, [refresh]);
}
