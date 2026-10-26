import { router, useFocusEffect, useNavigation } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { HeaderBackButton } from "expo-router/build/react-navigation/elements/Header/HeaderBackButton";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { BackHandler } from "react-native";

/** Protects Merchant editor exits, including native-stack removals and pending saves. */
export default function useMerchantEditorExit(
  hasChanges: boolean,
  isPending: boolean,
  isBusy: () => boolean,
) {
  const navigation = useNavigation();
  const [showDiscard, setShowDiscard] = useState(false);
  const pendingAction = useRef<(() => void) | null>(null);
  const allowed = useRef(false);
  const mounted = useRef(true);
  const latest = useRef({ hasChanges, isPending, isBusy });
  useLayoutEffect(() => {
    latest.current = { hasChanges, isPending, isBusy };
  }, [hasChanges, isPending, isBusy]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const busy = useCallback(
    () => latest.current.isPending || latest.current.isBusy(),
    [],
  );
  const requestExit = useCallback(
    (action: () => void = () => router.back()) => {
      if (busy() || allowed.current) return;
      if (latest.current.hasChanges) {
        pendingAction.current = action;
        setShowDiscard(true);
      } else {
        allowed.current = true;
        action();
      }
    },
    [busy],
  );

  usePreventRemove(hasChanges || isPending, ({ data }) => {
    if (allowed.current) {
      navigation.dispatch(data.action);
      return;
    }
    requestExit(() => navigation.dispatch(data.action));
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => <HeaderBackButton onPress={() => requestExit()} />,
    });
  }, [navigation, requestExit]);
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          requestExit();
          return true;
        },
      );
      return () => subscription.remove();
    }, [requestExit]),
  );

  function finish(action: () => void = () => router.back()) {
    if (!mounted.current || !navigation.isFocused() || allowed.current)
      return false;
    allowed.current = true;
    setShowDiscard(false);
    action();
    return true;
  }

  return {
    showDiscard,
    requestExit: () => requestExit(),
    keepEditing: () => {
      pendingAction.current = null;
      setShowDiscard(false);
    },
    discard: () => {
      if (busy()) return;
      const action = pendingAction.current;
      pendingAction.current = null;
      allowed.current = true;
      setShowDiscard(false);
      action?.();
    },
    finish,
  };
}
