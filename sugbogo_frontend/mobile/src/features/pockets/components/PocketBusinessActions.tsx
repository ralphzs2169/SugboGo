import { useNetInfo } from "@react-native-community/netinfo";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { BackHandler } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { isAuthSessionCurrent } from "@/shared/api/authSessionGeneration.service";
import {
  makeBusinessAvailableOffline,
  OfflineStorageActionError,
} from "@/features/offline-pockets/services/offlineStorageActions.service";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";
import { handleSystemError } from "@/shared/utils/apiErrors";
import type { ApiError } from "@/shared/types/apiResponse.types";

/** Adds explicit offline preparation to the existing per-business Pocket menu. */
export default function PocketBusinessActions({
  business,
  ownerId,
  generation,
  onRemove,
  onClose,
}: {
  business: { id: number; business_name: string };
  ownerId: number;
  generation: number;
  onRemove: () => void;
  onClose: () => void;
}) {
  const network = useNetInfo();
  const online =
    network.isConnected === true && network.isInternetReachable !== false;
  const sheet = useRef<BottomSheetModal | null>(null);
  const next = useRef<string | null>(null);
  const mounted = useRef(true);
  const busy = useRef(false);
  const [mode, setMode] = useState<"menu" | "restore">("menu");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const auth = useAuthStore();
  function current() {
    const auth = useAuthStore.getState();
    return (
      mounted.current &&
      auth.isAuthenticated &&
      !auth.isLoading &&
      auth.user?.id === ownerId &&
      isAuthSessionCurrent(generation)
    );
  }
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (mode !== "menu") return;
    presentBottomSheet(sheet);
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      sheet.current?.dismiss();
      return true;
    });
    return () => back.remove();
  }, [mode]);
  async function restore() {
    if (!current() || busy.current) return;
    if (!online) {
      setMode("restore");
      setError(
        "Connect to the internet to make this business available offline.",
      );
      return;
    }
    busy.current = true;
    setMode("restore");
    setPending(true);
    setError(null);
    try {
      await makeBusinessAvailableOffline(business.id);
      if (!current()) return;
      Toast.show({
        type: "success",
        text1: "Offline download requested",
        text2: "You can keep using SugboGo while it's prepared.",
      });
      onClose();
    } catch (failure) {
      if (!current()) return;
      setError(
        failure instanceof OfflineStorageActionError
          ? failure.message
          : "Unable to prepare this business. Please try again.",
      );
      if (
        failure &&
        typeof failure === "object" &&
        "success" in failure &&
        failure.success === false
      )
        handleSystemError(failure as ApiError);
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }
  if (
    !auth.isAuthenticated ||
    auth.isLoading ||
    auth.user?.id !== ownerId ||
    !isAuthSessionCurrent(generation)
  )
    return null;
  return (
    <>
      {mode === "menu" && (
        <ActionBottomSheet
          sheetRef={sheet}
          options={[
            { label: "Make available offline", value: "restore" },
            {
              label: "Remove from this Pocket",
              value: "remove",
              color: theme.extends.colors.error,
            },
          ]}
          onSelect={(value) => {
            if (!next.current) next.current = value;
          }}
          onDismiss={() => {
            if (!current()) return;
            const action = next.current;
            next.current = null;
            if (action === "restore") void restore();
            else {
              if (action === "remove") onRemove();
              onClose();
            }
          }}
        />
      )}
      <ConfirmModal
        visible={mode === "restore"}
        title={
          pending ? "Preparing offline download" : "Make available offline"
        }
        message={
          error ??
          `Checking that ${business.business_name} is still saved in My Pockets. Business information and photos will download on this device.`
        }
        confirmText={online ? "Try again" : "Close"}
        isLoading={pending}
        onConfirm={() => {
          if (online) void restore();
          else onClose();
        }}
        onCancel={() => {
          if (!busy.current) onClose();
        }}
      />
    </>
  );
}
