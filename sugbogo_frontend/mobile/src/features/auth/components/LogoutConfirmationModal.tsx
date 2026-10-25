import { useRef, useState } from "react";
import Toast from "react-native-toast-message";

import ConfirmModal from "@/shared/components/modals/ConfirmModal";

import { useLogout } from "../hooks/useLogout";
import { useLogoutConfirmationStore } from "../store/logoutConfirmation.store";

/**
 * Confirms logout and shows local cleanup progress above navigation.
 *
 * Remains mounted after authentication is revoked so redirecting away from
 * either profile does not interrupt loading feedback or allow duplicate taps.
 */
export default function LogoutConfirmationModal() {
  const isOpen = useLogoutConfirmationStore((state) => state.isOpen);
  const close = useLogoutConfirmationStore((state) => state.close);
  const { logout } = useLogout();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isSubmitting = useRef(false);

  const handleConfirm = async () => {
    if (isSubmitting.current) {
      return;
    }

    isSubmitting.current = true;
    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      Toast.show({
        type: "error",
        text1: "Unable to finish logout",
        text2: "Please try again.",
      });
    } finally {
      close();
      setIsLoggingOut(false);
      isSubmitting.current = false;
    }
  };

  return (
    <ConfirmModal
      visible={isOpen}
      title="Log out?"
      message="Are you sure you want to log out of your account?"
      confirmText="Logout"
      destructive
      isLoading={isLoggingOut}
      loadingText="Logging out..."
      onCancel={() => {
        if (!isSubmitting.current) {
          close();
        }
      }}
      onConfirm={() => void handleConfirm()}
    />
  );
}
