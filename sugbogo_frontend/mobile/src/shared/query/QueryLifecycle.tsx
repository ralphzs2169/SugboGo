import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";

import {
  classifyDeviceConnectivity,
  useDeviceConnectivity,
} from "@/shared/network/deviceConnectivity";

let subscribers = 0;
let stopNetwork: (() => void) | undefined;

/** Shares native listeners across mounts, including overlapping root lifetimes. */
export function subscribeNativeQueryLifecycle() {
  if (Platform.OS === "web") {
    return () => undefined;
  }

  subscribers += 1;

  if (subscribers === 1) {
    let active = true;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!active) return;

      const status = classifyDeviceConnectivity(state);
      useDeviceConnectivity.setState({ status });

      if (status === "offline") {
        onlineManager.setOnline(false);
      } else if (
        status === "online" ||
        (state.type !== "unknown" && state.isConnected === true)
      ) {
        // An attached network can schedule reads while reachability is pending.
        onlineManager.setOnline(true);
      }
    });
    stopNetwork = () => {
      active = false;
      unsubscribe();
      useDeviceConnectivity.setState({ status: "unknown" });
    };

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
      stopNetwork?.();
      stopNetwork = undefined;
      focusManager.setEventListener(() => undefined);
      focusManager.setFocused(undefined);
    }
  };
}

/** Connects the shared query client to native connectivity and app focus. */
export default function QueryLifecycle() {
  useEffect(() => {
    if (Platform.OS !== "web") {
      return subscribeNativeQueryLifecycle();
    }
    if (typeof window === "undefined") {
      return;
    }

    function updateBrowserConnectivity() {
      const online = window.navigator.onLine;
      useDeviceConnectivity.setState({
        status: online ? "online" : "offline",
      });
      return online;
    }

    onlineManager.setOnline(updateBrowserConnectivity());
    return onlineManager.subscribe(updateBrowserConnectivity);
  }, []);

  return null;
}
