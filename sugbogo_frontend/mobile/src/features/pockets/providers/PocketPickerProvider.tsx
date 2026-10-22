import { router } from "expo-router";
import { onlineManager } from "@tanstack/react-query";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";

import { useAuthStore } from "@/features/auth/store/auth.store";
import { getAuthSessionGeneration } from "@/shared/api/authSessionGeneration.service";

import PocketPickerSheet from "../components/PocketPickerSheet";
import { PocketPickerContext } from "./PocketPickerContext";

type Selection = { businessId: number; ownerId: number; generation: number };
/** Hosts one Pocket picker across Profile and Explore, pinned to its opening session. */
export default function PocketPickerProvider({ children }: PropsWithChildren) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const restoring = useAuthStore((state) => state.isLoading);
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedRef = useRef<Selection | null>(null);
  const closePocketPicker = useCallback((businessId: number) => {
    if (selectedRef.current?.businessId !== businessId) return;
    selectedRef.current = null;
    setSelection(null);
  }, []);
  const currentSelection =
    selection &&
    authenticated &&
    !restoring &&
    selection.ownerId === userId &&
    selection.generation === getAuthSessionGeneration()
      ? selection
      : null;

  useEffect(
    () =>
      useAuthStore.subscribe((session) => {
        const selected = selectedRef.current;
        if (
          selected &&
          (!session.isAuthenticated ||
            session.isLoading ||
            session.user?.id !== selected.ownerId ||
            getAuthSessionGeneration() !== selected.generation)
        ) {
          selectedRef.current = null;
          setSelection(null);
        }
      }),
    [],
  );

  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        if (!online && selectedRef.current) {
          closePocketPicker(selectedRef.current.businessId);
        }
      }),
    [closePocketPicker],
  );

  const openPocketPicker = useCallback((businessId: number) => {
    const session = useAuthStore.getState();
    if (
      session.isLoading ||
      !onlineManager.isOnline() ||
      !Number.isSafeInteger(businessId) ||
      businessId <= 0
    )
      return;
    if (!session.isAuthenticated || !session.user) {
      router.push("/(auth)/login");
      return;
    }
    if (selectedRef.current) return;
    const next = {
      businessId,
      ownerId: session.user.id,
      generation: getAuthSessionGeneration(),
    };
    selectedRef.current = next;
    setSelection(next);
  }, []);
  const value = useMemo(
    () => ({
      openPocketPicker,
      closePocketPicker,
      isOpen: currentSelection !== null,
    }),
    [openPocketPicker, closePocketPicker, currentSelection],
  );

  return (
    <PocketPickerContext.Provider value={value}>
      {children}
      {currentSelection && (
        <PocketPickerSheet
          key={`${currentSelection.ownerId}:${currentSelection.businessId}:${currentSelection.generation}`}
          {...currentSelection}
          isCurrent={() =>
            selectedRef.current === currentSelection && onlineManager.isOnline()
          }
          onDismiss={() => {
            if (selectedRef.current !== currentSelection) return;
            selectedRef.current = null;
            setSelection(null);
          }}
        />
      )}
    </PocketPickerContext.Provider>
  );
}
