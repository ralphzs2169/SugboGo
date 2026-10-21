import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useEffect, useRef, useState } from "react";
import { BackHandler, View } from "react-native";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import ActionBottomSheet from "@/shared/components/bottom-sheets/ActionBottomSheet";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";
import { presentBottomSheet } from "@/shared/utils/presentBottomSheet.utils";

import { useDeletePocketCollection } from "../hooks/usePocketCollectionMutations";
import type { PocketCollection } from "../types/pockets.types";
import PocketNameDialog from "./PocketNameDialog";

type Props = {
  collection: PocketCollection;
  onClose: () => void;
  onDeleted?: () => void;
};
type Selection = {
  kind: "menu" | "rename" | "delete";
  collection: PocketCollection;
  ownerId: number;
  generation: number;
};

/** Dismisses the collection action sheet before opening an owned edit or confirmation dialog. */
export default function PocketCollectionActions({
  collection,
  onClose,
  onDeleted,
}: Props) {
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const restoring = useAuthStore((state) => state.isLoading);
  const deletion = useDeletePocketCollection();
  const [selection, setSelection] = useState<Selection | null>(() =>
    !collection.is_default && userId
      ? {
          kind: "menu",
          collection,
          ownerId: userId,
          generation: getAuthSessionGeneration(),
        }
      : null,
  );
  const sheet = useRef<BottomSheetModal | null>(null);
  const nextAction = useRef<"rename" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const visible =
    selection !== null &&
    authenticated &&
    !restoring &&
    selection.ownerId === userId &&
    selection.collection.id === collection.id &&
    selection.generation === getAuthSessionGeneration();
  const menuOpen = visible && selection.kind === "menu";
  useEffect(() => {
    if (!menuOpen) return;
    presentBottomSheet(sheet);
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      sheet.current?.dismiss();
      return true;
    });
    return () => back.remove();
  }, [menuOpen]);

  function current(target: Selection) {
    const session = useAuthStore.getState();
    return (
      mounted.current &&
      session.isAuthenticated &&
      !session.isLoading &&
      session.user?.id === target.ownerId &&
      getAuthSessionGeneration() === target.generation
    );
  }
  function close() {
    setSelection(null);
    onClose();
  }
  async function remove() {
    const target = selection;
    if (!target || target.kind !== "delete" || busy.current || !current(target))
      return;
    busy.current = true;
    setError(null);
    try {
      await deletion.deleteCollection(target.collection);
      if (!current(target)) return;
      close();
      Toast.show({
        type: "info",
        text1: "Pocket deleted",
        visibilityTime: 1500,
      });
      onDeleted?.();
    } catch (failure) {
      if (!current(target)) return;
      const response = failure as Partial<ApiError>;
      setError(
        response.message || "Unable to delete this Pocket. Please try again.",
      );
      if (response.success === false) handleSystemError(response as ApiError);
    } finally {
      busy.current = false;
    }
  }

  if (collection.is_default) return null;
  return (
    <>
      {menuOpen && (
        <ActionBottomSheet
          sheetRef={sheet}
          options={[
            { label: "Rename Pocket", value: "rename" },
            {
              label: "Delete Pocket",
              value: "delete",
              color: theme.extends.colors.error,
            },
          ]}
          onSelect={(value) => {
            if (
              selection &&
              current(selection) &&
              !nextAction.current &&
              (value === "rename" || value === "delete")
            )
              nextAction.current = value;
          }}
          onDismiss={() => {
            if (!selection || !current(selection)) return;
            const action = nextAction.current;
            nextAction.current = null;
            if (action) setSelection({ ...selection, kind: action });
            else close();
          }}
        />
      )}
      {visible && selection.kind === "rename" && (
        <PocketNameDialog
          collection={selection.collection}
          onCancel={close}
          onSuccess={close}
        />
      )}
      {visible && selection.kind === "delete" && (
        <ConfirmModal
          visible
          title="Delete this Pocket?"
          message={
            <View>
              <AppText className="text-body text-text-secondary">
                Delete {selection.collection.name}? Businesses saved in other
                Pockets will stay there. This cannot be undone.
              </AppText>
              {error && (
                <AppText
                  accessibilityRole="alert"
                  className="mt-3 text-body text-text-error"
                >
                  {error}
                </AppText>
              )}
            </View>
          }
          confirmText="Delete Pocket"
          destructive
          isLoading={deletion.isPending}
          loadingText="Deleting Pocket..."
          onCancel={() => {
            if (!busy.current) close();
          }}
          onConfirm={() => {
            void remove();
          }}
        />
      )}
    </>
  );
}
