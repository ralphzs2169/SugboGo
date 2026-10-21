import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import ConfirmModal from "@/shared/components/modals/ConfirmModal";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import { useRemovePocketBusiness } from "../hooks/usePocketCollectionMutations";

type Props = {
  collectionId: number;
  business: { id: number; business_name: string };
  ownerId: number;
  generation: number;
  onClose: () => void;
};

/** Removes only this membership; the server decides the aggregate saved flag. */
export default function PocketBusinessRemovalConfirmation({
  collectionId,
  business,
  ownerId,
  generation,
  onClose,
}: Props) {
  const removal = useRemovePocketBusiness();
  const userId = useAuthStore((state) => state.user?.id);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const restoring = useAuthStore((state) => state.isLoading);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  function current() {
    const session = useAuthStore.getState();
    return (
      mounted.current &&
      session.isAuthenticated &&
      !session.isLoading &&
      session.user?.id === ownerId &&
      getAuthSessionGeneration() === generation
    );
  }
  async function remove() {
    if (busy.current || !current()) return;
    busy.current = true;
    setError(null);
    try {
      await removal.removeBusiness({ collectionId, businessId: business.id });
      if (!current()) return;
      Toast.show({
        type: "info",
        text1: "Business removed from this Pocket",
        visibilityTime: 1500,
      });
      onClose();
    } catch (failure) {
      if (!current()) return;
      const response = failure as Partial<ApiError>;
      setError(
        response.message || "Unable to remove this business. Please try again.",
      );
      if (response.success === false) handleSystemError(response as ApiError);
    } finally {
      busy.current = false;
    }
  }
  if (
    !authenticated ||
    restoring ||
    userId !== ownerId ||
    getAuthSessionGeneration() !== generation
  )
    return null;
  return (
    <ConfirmModal
      visible
      title="Remove this business?"
      message={
        <View>
          <AppText className="text-body text-text-secondary">
            Remove {business.business_name} from this Pocket? Businesses saved
            in other Pockets will stay there.
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
      confirmText="Remove"
      destructive
      isLoading={removal.isPending}
      loadingText="Removing business..."
      onCancel={() => {
        if (!busy.current) onClose();
      }}
      onConfirm={() => {
        void remove();
      }}
    />
  );
}
