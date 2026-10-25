import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

/** Guards a screen's navigation dispatches until it regains focus or dispatch fails. */
export default function useNavigationAction() {
  const pending = useRef(false);
  const focused = useRef(false);

  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      focused.current = true;
      return () => {
        focused.current = false;
      };
    }, []),
  );

  return useCallback((action: () => void | false) => {
    if (!focused.current || pending.current) return;
    pending.current = true;
    try {
      if (action() === false) pending.current = false;
    } catch (error) {
      pending.current = false;
      throw error;
    }
  }, []);
}
