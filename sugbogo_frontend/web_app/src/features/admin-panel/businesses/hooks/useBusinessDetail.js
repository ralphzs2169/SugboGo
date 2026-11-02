import { BUSINESS_CHANGED_EVENT } from "../queries/businessResourceEvents";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBusiness } from "../services/businessService";
import { useAuthStore } from "@/features/auth/storage/auth.store";
import {
  getSessionGeneration,
  subscribeToSessionChanges,
} from "@/shared/api/storage";

/**
 * Fetches the complete administrator-facing details for a single business.
 *
 * Retains successful content on refresh failure and guards request, business and session ownership.
 */
export default function useBusinessDetail(businessId, { enabled = true } = {}) {
  const [state, setState] = useState({
    id: null,
    business: null,
    error: null,
    fetching: false,
  });
  const latestRequest = useRef(0);
  const controller = useRef(null);

  const loadBusiness = useCallback(async () => {
    if (!enabled || !businessId) return null;
    const requestId = ++latestRequest.current;
    const generation = getSessionGeneration();
    controller.current?.abort();
    const request = new AbortController();
    controller.current = request;
    setState((previous) => ({
      id: String(businessId),
      business: previous.id === String(businessId) ? previous.business : null,
      error: null,
      fetching: true,
    }));
    try {
      const business = await fetchBusiness(businessId, {
        signal: request.signal,
      });
      if (
        request.signal.aborted ||
        requestId !== latestRequest.current ||
        generation !== getSessionGeneration()
      )
        return null;
      setState({
        id: String(businessId),
        business,
        error: null,
        fetching: false,
      });
      return business;
    } catch (error) {
      if (
        request.signal.aborted ||
        requestId !== latestRequest.current ||
        generation !== getSessionGeneration()
      )
        return null;
      setState((previous) => ({ ...previous, error, fetching: false }));
      return null;
    }
  }, [businessId, enabled]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Initial loading owns this resource; later reads retain its last successful content.
    loadBusiness();
    function refreshChangedBusiness(event) {
      if (
        event.detail?.businessId == null ||
        String(event.detail.businessId) === String(businessId)
      )
        void loadBusiness();
    }
    function endOwnership() {
      latestRequest.current += 1;
      controller.current?.abort();
      setState({ id: null, business: null, error: null, fetching: false });
    }
    const unsubscribeSession = subscribeToSessionChanges(endOwnership);
    const unsubscribeAuth = useAuthStore.subscribe((next, previous) => {
      if (
        next.user?.id !== previous.user?.id ||
        (previous.isAuthenticated && !next.isAuthenticated)
      ) {
        endOwnership();
      }
    });
    window.addEventListener(BUSINESS_CHANGED_EVENT, refreshChangedBusiness);
    window.addEventListener("focus", loadBusiness);
    return () => {
      latestRequest.current += 1;
      controller.current?.abort();
      unsubscribeSession();
      unsubscribeAuth();
      window.removeEventListener(
        BUSINESS_CHANGED_EVENT,
        refreshChangedBusiness,
      );
      window.removeEventListener("focus", loadBusiness);
    };
  }, [enabled, loadBusiness, businessId]);

  const ownsData = enabled && state.id === String(businessId);
  const business = ownsData ? state.business : null;
  const error = ownsData ? state.error : null;
  return {
    business,
    isLoading: enabled && !business && (!ownsData || state.fetching),
    isFetching: ownsData && state.fetching,
    error,
    refetch: loadBusiness,
  };
}
