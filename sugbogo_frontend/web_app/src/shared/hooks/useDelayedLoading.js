import { useEffect, useState } from "react";

export function useDelayedLoading(loading, delay = 300) {
  const [showLoader, setShowLoader] = useState(false);

  useEffect(() => {
    if (!loading) {
      setShowLoader(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowLoader(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [loading, delay]);

  return showLoader;
}
