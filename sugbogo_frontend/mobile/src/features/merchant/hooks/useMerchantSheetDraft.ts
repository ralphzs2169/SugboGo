import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { usePreventRemove } from "expo-router/react-navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { BackHandler } from "react-native";

/** Keeps composer drafts mounted during attempted dismissal and locks an active submission. */
export default function useMerchantSheetDraft(
  sheetRef: RefObject<BottomSheetModal | null>,
  hasChanges: boolean,
  mutationPending: boolean,
  identity: number | null,
) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const savingRef = useRef(false);
  const openRef = useRef(false);
  const allowed = useRef(false);
  const mounted = useRef(true);
  const session = useRef(0);
  const previousIdentity = useRef(identity);
  useLayoutEffect(() => {
    if (previousIdentity.current !== identity) {
      previousIdentity.current = identity;
      session.current += 1;
    }
  }, [identity]);
  const pending = mutationPending || isSaving;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      session.current += 1;
    };
  }, []);

  function dismiss() {
    if (allowed.current) return;
    allowed.current = true;
    setShowDiscard(false);
    sheetRef.current?.dismiss();
  }
  function requestDismiss() {
    if (savingRef.current || pending || allowed.current) return;
    if (hasChanges) setShowDiscard(true);
    else dismiss();
  }
  usePreventRemove(isOpen && (hasChanges || pending), () => requestDismiss());
  useEffect(() => {
    if (!isOpen) return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        requestDismiss();
        return true;
      },
    );
    return () => subscription.remove();
  });

  return {
    pending,
    savingRef,
    showDiscard,
    requestDismiss,
    keepEditing: () => setShowDiscard(false),
    discard: () => {
      if (!savingRef.current && !pending) dismiss();
    },
    onChange: (index: number) => {
      if (index >= 0) {
        if (!openRef.current) {
          allowed.current = false;
          session.current += 1;
        }
        openRef.current = true;
        setIsOpen(true);
      } else if (openRef.current && !allowed.current) {
        // Modal onClose is private. With automatic dismissal disabled, onChange
        // can restore the same mounted modal with present(). snapToIndex is
        // ignored by Gorhom while its modal status is minimized.
        if (hasChanges || pending || savingRef.current) {
          sheetRef.current?.present();
          requestDismiss();
        } else dismiss();
      }
    },
    onDismiss: () => {
      openRef.current = false;
      savingRef.current = false;
      session.current += 1;
      setIsOpen(false);
      setIsSaving(false);
      setShowDiscard(false);
    },
    beginSave: () => {
      if (!openRef.current || savingRef.current || pending || allowed.current)
        return null;
      savingRef.current = true;
      setIsSaving(true);
      return session.current;
    },
    completeSave: (token: number) => {
      if (mounted.current && openRef.current && session.current === token)
        dismiss();
    },
    endSave: () => {
      // Keep controls locked through the successful dismissal animation.
      if (allowed.current) return;
      savingRef.current = false;
      if (mounted.current) setIsSaving(false);
    },
  };
}
