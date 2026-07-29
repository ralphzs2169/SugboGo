import { forwardRef, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Reusable floating overlay anchored to an element.
 *
 * Renders its children in a React Portal so the content
 * is never clipped by parent containers.
 *
 * @component
 *
 * @param {Object} props
 * @param {React.RefObject<HTMLElement>} props.anchorRef - Element the flyout is anchored to.
 * @param {boolean} props.open - Controls visibility.
 * @param {React.ReactNode} props.children - Flyout content.
 * @param {number} [props.offset=8] - Gap between the anchor and the flyout.
 *
 * @returns {JSX.Element|null}
 */
const Flyout = forwardRef(function Flyout(
  { anchorRef, open, children, offset = 8 },
  ref,
) {
  const [position, setPosition] = useState({
    top: 0,
    left: 0,
  });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;

    const updatePosition = () => {
      const rect = anchorRef.current.getBoundingClientRect();

      setPosition({
        top: rect.top,
        left: rect.right + offset,
      });
    };

    updatePosition();

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, anchorRef, offset]);

  if (!open) return null;

  return createPortal(
    <div
      ref={ref}
      className="fixed z-[9999]"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      {children}
    </div>,
    document.body,
  );
});

export default Flyout;
