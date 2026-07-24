import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { router, useNavigation } from "expo-router";

/**
 * Custom hook to guard against unsaved changes when navigating away from a screen.
 */
export function useUnsavedChangesGuard(hasChanges: boolean) {
  const navigation = useNavigation();
  const canLeaveRef = useRef(false);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!hasChanges || canLeaveRef.current) {
        return;
      }

      event.preventDefault();

      Alert.alert(
        "Discard changes?",
        "You have unsaved changes. Are you sure you want to leave this page?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              canLeaveRef.current = true;
              router.back();
            },
          },
        ],
      );
    });

    return unsubscribe;
  }, [navigation, hasChanges]);

  function allowLeave() {
    canLeaveRef.current = true;
  }

  return {
    allowLeave,
  };
}
