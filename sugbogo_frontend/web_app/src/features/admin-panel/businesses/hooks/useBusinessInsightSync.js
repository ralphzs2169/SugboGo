import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import {
  getSessionGeneration,
  subscribeToSessionChanges,
} from "@/shared/api/storage";
import { hasPendingBusinessInsights } from "../utils/businessDetailPresentation";

export const INSIGHT_POLL_INTERVAL = 15_000;
export const INSIGHT_POLL_LIMIT = 60;

/** Observe durable work with bounded, visible-page-only reads and session cancellation. */
export default function useBusinessInsightSync(business, refetch) {
  const [request, setRequest] = useState(0);
  const [state, setState] = useState("idle");
  const observedRequest = useRef(0);
  const pending = hasPendingBusinessInsights(business);
  const businessId = business?.id;
  const observe = useCallback(() => setRequest((value) => value + 1), []);

  useEffect(() => {
    const requested = request !== observedRequest.current;
    if (!businessId || (!pending && !requested)) return undefined;
    observedRequest.current = request;
    let stopped = false;
    let timer;
    let reading = false;
    let attempts = 0;
    const generation = getSessionGeneration();
    const deadline = Date.now() + INSIGHT_POLL_INTERVAL * INSIGHT_POLL_LIMIT;
    function stop() {
      stopped = true;
      clearTimeout(timer);
    }
    async function read() {
      clearTimeout(timer);
      if (stopped || reading || document.visibilityState === "hidden") return;
      if (generation !== getSessionGeneration()) return stop();
      if (attempts >= INSIGHT_POLL_LIMIT || Date.now() >= deadline) {
        setState("paused");
        return stop();
      }
      reading = true;
      attempts += 1;
      setState("observing");
      const updated = await refetch();
      reading = false;
      if (stopped || generation !== getSessionGeneration()) return;
      if (!updated) {
        setState("error");
        return stop();
      }
      if (!hasPendingBusinessInsights(updated)) {
        setState("complete");
        return stop();
      }
      timer = setTimeout(read, INSIGHT_POLL_INTERVAL);
    }
    function visibilityChanged() {
      clearTimeout(timer);
      if (document.visibilityState !== "hidden") void read();
    }
    const unsubscribeSession = subscribeToSessionChanges(stop);
    const unsubscribeAuth = useAuthStore.subscribe((next, previous) => {
      if (
        next.user?.id !== previous.user?.id ||
        (previous.isAuthenticated && !next.isAuthenticated)
      )
        stop();
    });
    timer = setTimeout(read, requested ? 0 : INSIGHT_POLL_INTERVAL);
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => {
      stop();
      unsubscribeSession();
      unsubscribeAuth();
      document.removeEventListener("visibilitychange", visibilityChanged);
    };
  }, [businessId, pending, refetch, request]);
  return { state, observe };
}
