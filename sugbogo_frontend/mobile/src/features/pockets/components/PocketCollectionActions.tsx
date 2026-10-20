import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useDeletePocketCollection } from "../hooks/usePocketCollectionMutations";
import type { PocketCollection } from "../types/pockets.types";
import PocketNameDialog from "./PocketNameDialog";

type Props = { collection: PocketCollection; onDeleted: () => void };
type Selection = {
  kind: "rename" | "delete";
  collection: PocketCollection;
  ownerId: number;
  generation: number;
};

/** Management belongs to an owned detail surface; Favorites has no management actions. */
export default function PocketCollectionActions({
  collection,
  onDeleted,
}: Props) {
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const restoring = useAuthStore((state) => state.isLoading);
  const deletion = useDeletePocketCollection();
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

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
  function open(kind: Selection["kind"]) {
    if (
      !authenticated ||
      restoring ||
      !userId ||
      collection.is_default ||
      busy.current
    )
      return;
    setError(null);
    setSelection({
      kind,
      collection,
      ownerId: userId,
      generation: getAuthSessionGeneration(),
    });
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
      setSelection(null);
      Toast.show({
        type: "info",
        text1: "Pocket deleted",
        visibilityTime: 1500,
      });
      onDeleted();
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
  const visible =
    selection !== null &&
    authenticated &&
    !restoring &&
    selection.ownerId === userId &&
    selection.collection.id === collection.id &&
    selection.generation === getAuthSessionGeneration();
  return (
    <View className="mt-3 flex-row gap-3">
      <Button
        title="Rename Pocket"
        variant="outline"
        className="flex-1"
        disabled={deletion.isPending}
        onPress={() => open("rename")}
      />
      <Button
        title="Delete Pocket"
        variant="outline"
        className="flex-1"
        disabled={deletion.isPending}
        onPress={() => open("delete")}
      />
      {visible && selection.kind === "rename" && (
        <PocketNameDialog
          collection={selection.collection}
          onCancel={() => setSelection(null)}
          onSuccess={() => setSelection(null)}
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
                  className="mt-3 text-body text-error"
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
            if (!busy.current) setSelection(null);
          }}
          onConfirm={() => {
            void remove();
          }}
        />
      )}
    </View>
  );
}
