import { useEffect, useRef, useState } from "react";
import { router, useNavigation } from "expo-router";
import { useAuthStore } from "@/features/auth/store/auth.store";

export function useUnsavedChangesGuard(hasChanges: boolean) {
  const navigation = useNavigation();
  const canLeaveRef = useRef(false);

  const [showConfirm, setShowConfirm] = useState(false);

  const isAuthenticated = useAuthStore((state) => !!state.user);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!isAuthenticated) {
        return;
      }

      if (!hasChanges || canLeaveRef.current) {
        return;
      }

      event.preventDefault();

      setShowConfirm(true);
    });

    return unsubscribe;
  }, [navigation, hasChanges, isAuthenticated]);

  function confirmLeave() {
    canLeaveRef.current = true;
    setShowConfirm(false);
    router.back();
  }

  function cancelLeave() {
    setShowConfirm(false);
  }

  return {
    showConfirm,
    confirmLeave,
    cancelLeave,
  };
}
