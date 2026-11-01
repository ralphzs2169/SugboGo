import { useCallback, useEffect, useRef, useState } from "react";
import useMediaQuery from "@/shared/hooks/useMediaQuery";

/** Animate the first valid dataset only, stopping for interaction, replacement data, or reduced motion. */
export default function useChartEntrance(
  data,
  { animationDuration = 400, animationEasing = "ease-out" } = {},
) {
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const firstData = useRef(null);
  const [finished, setFinished] = useState(false);
  const stop = useCallback(() => setFinished(true), []);

  useEffect(() => {
    if (!data) return;
    if (firstData.current === null) firstData.current = data;
    if (firstData.current !== data || reducedMotion) stop();
  }, [data, reducedMotion, stop]);

  useEffect(() => {
    if (!data || finished) return;
    // The timeout also covers all-zero charts where Recharts has no path to animate.
    const timer = setTimeout(stop, animationDuration + 100);
    return () => clearTimeout(timer);
  }, [data, finished, stop, animationDuration]);

  return {
    isAnimationActive: Boolean(data) && !reducedMotion && !finished,
    animationDuration,
    animationEasing,
    onAnimationEnd: stop,
    stop,
  };
}
