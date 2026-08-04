import { useEffect, useState } from "react";

/**
 * Delays the loading indicator to prevent brief loading flashes.
 *
 * If loading finishes before the delay, the loading indicator
 * is never shown. If loading continues beyond the delay, the
 * indicator is shown until loading completes.
 *
 */
export default function useDelayedLoading(isLoading, delay = 200) {
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoading(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isLoading, delay]);

  return showLoading;
}
