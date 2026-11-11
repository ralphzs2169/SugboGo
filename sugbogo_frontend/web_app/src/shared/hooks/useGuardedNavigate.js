import { useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const NAVIGATION_REQUEST_EVENT = "admin-navigation-request";

/** Let an active draft guard handle navigation before changing the route. */
export default function useGuardedNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (destination) => {
      const request = new window.CustomEvent(NAVIGATION_REQUEST_EVENT, {
        cancelable: true,
        detail: { destination },
      });

      if (window.dispatchEvent(request)) {
        navigate(destination);
      }
    },
    [navigate],
  );
}
