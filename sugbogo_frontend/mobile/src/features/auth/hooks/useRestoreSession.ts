import { useEffect, useRef } from "react";
import { restoreSession } from "../services/restoreSession.service";

/** Validates startup identity once; transport failure may grant local resource browsing only. */
export function useRestoreSession() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void restoreSession().catch(() => undefined);
  }, []);
}
