import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const WARNING_MESSAGE =
  "You have unsaved route changes. Leave this page and discard them?";

export default function useUnsavedChangesGuard(isDirty) {
  const navigate = useNavigate();
  const allowNavigationRef = useRef(false);
  const [pendingDestination, setPendingDestination] = useState(null);

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event) {
      if (allowNavigationRef.current || event.defaultPrevented) {
        return;
      }

      const anchor = event.target.closest?.("a[href]");

      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      const current = new URL(window.location.href);

      if (destination.href === current.href) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPendingDestination(destination.href);
    }

    function handlePopState() {
      if (allowNavigationRef.current) {
        return;
      }

      if (window.confirm(WARNING_MESSAGE)) {
        allowNavigationRef.current = true;
      } else {
        window.history.forward();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty]);

  const requestNavigation = useCallback(
    (destination) => {
      if (isDirty && !allowNavigationRef.current) {
        setPendingDestination(destination);
        return;
      }

      navigate(destination);
    },
    [isDirty, navigate],
  );

  function discardAndLeave() {
    if (!pendingDestination) {
      return;
    }

    allowNavigationRef.current = true;
    const destination = new URL(pendingDestination, window.location.href);

    if (destination.origin === window.location.origin) {
      navigate(
        `${destination.pathname}${destination.search}${destination.hash}`,
      );
    } else {
      window.location.assign(destination.href);
    }
  }

  function stayOnPage() {
    setPendingDestination(null);
  }

  function allowNavigation() {
    allowNavigationRef.current = true;
  }

  return {
    requestNavigation,
    allowNavigation,
    discardAndLeave,
    stayOnPage,
    isLeaveConfirmationOpen: Boolean(pendingDestination),
  };
}
