import { useLayoutEffect, useMemo, useRef, useState } from "react";

/** Keep one dialog session's submission and completion separate from later sessions. */
export default function useModalSubmission(
  isOpen,
  targetKey,
  onClose,
) {
  const owner = useMemo(() => ({}), [isOpen, targetKey]);
  const activeOwner = useRef(null);
  const pendingOwner = useRef(null);
  const [pending, setPending] = useState(null);

  useLayoutEffect(() => {
    activeOwner.current = isOpen ? owner : null;

    return () => {
      if (activeOwner.current === owner) {
        activeOwner.current = null;
      }
    };
  }, [isOpen, owner]);

  async function runSubmission(operation) {
    if (
      activeOwner.current !== owner ||
      pendingOwner.current === owner
    ) {
      return;
    }

    pendingOwner.current = owner;
    setPending(owner);
    const isCurrent = () => activeOwner.current === owner;

    try {
      await operation(isCurrent);
    } finally {
      if (pendingOwner.current === owner) {
        pendingOwner.current = null;
      }
      if (isCurrent()) {
        setPending(null);
      }
    }
  }

  function close() {
    if (
      activeOwner.current === owner &&
      pendingOwner.current !== owner
    ) {
      onClose?.();
    }
  }

  return {
    isSubmitting: isOpen && pending === owner,
    runSubmission,
    close,
  };
}
