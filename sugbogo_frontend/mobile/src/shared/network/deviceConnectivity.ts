import type { NetInfoState } from "@react-native-community/netinfo";
import { create } from "zustand";

export type DeviceConnectivity = "unknown" | "offline" | "online";

/** Classifies reachability independently of API responses and query scheduling. */
export function classifyDeviceConnectivity(
  state: Pick<NetInfoState, "type" | "isConnected" | "isInternetReachable">,
): DeviceConnectivity {
  // Android can report false for both flags before it knows the network type.
  if (state.type === "unknown") {
    return "unknown";
  }

  if (
    state.type === "none" ||
    state.isConnected === false ||
    state.isInternetReachable === false
  ) {
    return "offline";
  }

  return state.isInternetReachable === true ? "online" : "unknown";
}

/** Holds the latest device observation from the app's connectivity listener. */
export const useDeviceConnectivity = create<{ status: DeviceConnectivity }>(
  () => ({ status: "unknown" }),
);
