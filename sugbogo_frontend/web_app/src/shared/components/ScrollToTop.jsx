import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Controls page scroll position based on navigation direction.
 *
 * New navigations start at the top, while browser history navigation
 * preserves the previous scroll position.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") {
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: "auto",
    });
  }, [pathname, navigationType]);

  return null;
}
