import { useEffect, useRef, useState, type ComponentType } from "react";
import { View, type TextInputProps } from "react-native";
import Toast from "react-native-toast-message";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";
import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import FormInput from "@/shared/components/form/FormInput";
import type { ApiError } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import {
  useCreatePocketCollection,
  useRenamePocketCollection,
} from "../hooks/usePocketCollectionMutations";
import type { PocketCollection } from "../types/pockets.types";

const MIN_POCKET_NAME_LENGTH = 3;

export type PocketNameFormProps = {
  collection?: PocketCollection;
  onSuccess: (collection: PocketCollection) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  InputComponent?: ComponentType<TextInputProps>;
};

/** Creates or renames a Pocket while retaining input and field errors for retry. */
export default function PocketNameForm({
  collection,
  onSuccess,
  onCancel,
  onBusyChange,
  InputComponent,
}: PocketNameFormProps) {
  const create = useCreatePocketCollection();
  const rename = useRenamePocketCollection();
  const [identity] = useState(() => ({
    ownerId: useAuthStore.getState().user?.id,
    generation: getAuthSessionGeneration(),
  }));
  const [name, setName] = useState(collection?.name ?? "");
  const [error, setError] = useState<string | undefined>();
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const pending = create.isPending || rename.isPending;
  function current() {
    const session = useAuthStore.getState();
    return (
      mounted.current &&
      session.isAuthenticated &&
      !session.isLoading &&
      session.user?.id === identity.ownerId &&
      getAuthSessionGeneration() === identity.generation
    );
  }
  async function save() {
    if (busy.current || !current()) return;
    if (!name.trim()) {
      setError("Pocket name is required.");
      return;
    }
    if (name.trim().length < MIN_POCKET_NAME_LENGTH) {
      setError("Pocket name must be at least 3 characters.");
      return;
    }
    busy.current = true;
    onBusyChange?.(true);
    setError(undefined);
    try {
      const saved = collection
        ? await rename.renameCollection({ collection, name })
        : await create.createCollection(name);
      if (!current()) return;
      Toast.show({
        type: "info",
        text1: collection ? "Pocket renamed" : "Pocket created",
        visibilityTime: 1500,
      });
      onSuccess(saved);
    } catch (failure) {
      if (!current()) return;
      const response = failure as Partial<ApiError>;
      setError(
        response.errors?.name?.[0] ||
          response.message ||
          "Unable to save this Pocket. Please try again.",
      );
      if (response.success === false) handleSystemError(response as ApiError);
    } finally {
      busy.current = false;
      onBusyChange?.(false);
    }
  }
  return (
    <View>
      {/* Pocket identity and name */}
      <AppText weight="bold" className="mb-4 text-lg text-text-primary">
        {collection ? "Rename Pocket" : "Create Pocket"}
      </AppText>
      <FormInput
        label="Pocket name"
        accessibilityLabel="Pocket name"
        minLength={MIN_POCKET_NAME_LENGTH}
        showCharacterCount
        required
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(undefined);
        }}
        error={error}
        helperText="Up to 100 characters. Choose a unique name."
        placeholder="e.g. Coffee spots"
        editable={!pending}
        autoCapitalize="sentences"
        returnKeyType="done"
        onSubmitEditing={() => {
          void save();
        }}
        InputComponent={InputComponent}
      />
      {/* Explicit submission and cancellation */}
      <View className="mt-5 flex-row gap-3">
        <Button
          title="Cancel"
          variant="outline"
          rounded="full"
          className="flex-1"
          disabled={pending}
          onPress={() => {
            if (!busy.current) onCancel();
          }}
        />
        <Button
          title={collection ? "Save name" : "Create Pocket"}
          rounded="full"
          className="flex-1"
          loading={pending}
          disabled={
            name.trim().length < MIN_POCKET_NAME_LENGTH ||
            collection?.is_default ||
            (collection !== undefined && name === collection.name)
          }
          onPress={() => {
            void save();
          }}
        />
      </View>
    </View>
  );
}
