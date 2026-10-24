import { useCallback, useEffect, useRef, useState } from "react";

import { useAuthStore } from "../store/auth.store";
import { restoreSession } from "../services/restoreSession.service";

/** Validates startup identity and offers recovery without discarding saved credentials. */
export function useRestoreSession() {
  const [attempt, setAttempt] = useState(0);
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const restoredAttempt = useRef(-1);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (restoredAttempt.current === attempt) {
      return;
    }
    restoredAttempt.current = attempt;

    void restoreSession()
      .then((result) => {
        setRecoveryRequired(result === "offline" || result === "recovery");
      })
      .catch(() => {
        // Cleanup failures must still leave a usable recovery path.
        setRecoveryRequired(true);
      });
  }, [attempt]);

  const retry = useCallback(() => {
    setRecoveryRequired(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  }, [setLoading]);

  return {
    recoveryRequired,
    retry,
    continueWithoutSession: () => setRecoveryRequired(false),
  };
}
