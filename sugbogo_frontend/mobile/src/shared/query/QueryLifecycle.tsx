import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

let subscribers = 0;

/** Shares native listeners across mounts, including overlapping root lifetimes. */
export function subscribeNativeQueryLifecycle() {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  subscribers += 1;

  if (subscribers === 1) {
    onlineManager.setEventListener((setOnline) => {
      let active = true;
      const unsubscribe = NetInfo.addEventListener((state) => {
        if (active) {
          setOnline(
            state.isConnected === true && state.isInternetReachable !== false,
          );
        }
      });

      return () => {
        active = false;
        unsubscribe();
      };
    });

    focusManager.setEventListener((setFocused) => {
      let active = true;

      if (AppState.currentState !== null) {
        setFocused(AppState.currentState === "active");
      }

      const subscription = AppState.addEventListener("change", (state) => {
        if (active) {
          setFocused(state === "active");
        }
      });

      return () => {
        active = false;
        subscription.remove();
      };
    });
  }

  let released = false;

  return () => {
    if (released) {
      return;
    }

    released = true;
    subscribers -= 1;

    if (subscribers === 0) {
      onlineManager.setEventListener(() => undefined);
      focusManager.setEventListener(() => undefined);
      focusManager.setFocused(undefined);
    }
  };
}

/** Connects the shared query client to native connectivity and app focus. */
export default function QueryLifecycle() {
  useEffect(subscribeNativeQueryLifecycle, []);

  return null;
}
