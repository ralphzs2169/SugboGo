import { useCallback, useRef } from "react";

import { shareBusinessProfile } from "../utils/businessProfileActions";

/** Shares one profile from either header while allowing only one native sheet. */
export default function useBusinessProfileShare(
  business: Parameters<typeof shareBusinessProfile>[0] | null,
) {
  const pending = useRef(false);
  return useCallback(async () => {
    if (!business || pending.current) return;
    pending.current = true;
    try {
      await shareBusinessProfile(business);
    } finally {
      pending.current = false;
    }
  }, [business]);
}
