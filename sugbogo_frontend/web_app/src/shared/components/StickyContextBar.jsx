import { useLayoutEffect, useRef, useState } from "react";

/**
 * Provides a persistent sticky context bar for long admin pages.
 *
 * Keeps caller-provided content visible while scrolling without imposing
 * page-specific navigation, identity, or status behavior. Callers can defer
 * the background until the bar reaches its sticky offset.
 */
export default function StickyContextBar({
  children,
  responsive = false,
  ariaLabel,
  backgroundOnStickOnly = false,
  onStuckChange,
}) {
  const barRef = useRef(null);
  const [isStuck, setIsStuck] = useState(false);
  const stuckRef = useRef(false);

  useLayoutEffect(() => {
    if (!backgroundOnStickOnly) return undefined;

    let frame;
    function updatePosition() {
      const bar = barRef.current;
      if (!bar) return;
      const offset = Number.parseFloat(window.getComputedStyle(bar).top);
      const stuck = bar.getBoundingClientRect().top <= offset;
      if (stuck !== stuckRef.current) {
        stuckRef.current = stuck;
        setIsStuck(stuck);
        onStuckChange?.(stuck);
      }
    }
    function scheduleUpdate() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(updatePosition);
    }

    updatePosition();
    // Capture scrolling ancestors as well as the document without changing layout.
    window.addEventListener("scroll", scheduleUpdate, { capture: true, passive: true });
    window.addEventListener("resize", scheduleUpdate);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleUpdate, true);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [backgroundOnStickOnly, onStuckChange]);

  const showBackground = !backgroundOnStickOnly || isStuck;
  return (
    <div ref={barRef} role={ariaLabel ? "region" : undefined} aria-label={ariaLabel}
      className={`sticky top-16 z-30 -mx-6 w-[calc(100%+3rem)] border-b motion-safe:transition-colors motion-safe:duration-200 ${showBackground ? "border-stroke bg-background/90 backdrop-blur" : "border-transparent bg-transparent"} ${responsive ? "sm:-mx-4 sm:w-[calc(100%+2rem)]" : ""}`}>
      <div className={`flex w-full min-w-0 items-center justify-between px-6 ${responsive ? "min-h-12 flex-wrap gap-2 py-2 sm:px-4 lg:gap-4 lg:py-1" : "h-12 gap-4"}`}>
        {children}
      </div>
    </div>
  );
}
