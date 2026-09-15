import * as Linking from "expo-linking";

export const GRAB_BOOKING_DEEP_LINK = "grab://open?screenType=BOOKING";

export type GrabHandoffResult = "opened" | "unavailable" | "failed";

let pendingHandoff: Promise<GrabHandoffResult> | null = null;

async function performGrabHandoff(): Promise<GrabHandoffResult> {
  try {
    const canOpenGrab = await Linking.canOpenURL(GRAB_BOOKING_DEEP_LINK);

    if (!canOpenGrab) {
      return "unavailable";
    }

    await Linking.openURL(GRAB_BOOKING_DEEP_LINK);

    return "opened";
  } catch {
    return "failed";
  }
}

/** Opens Grab booking once while coalescing repeated in-flight requests. */
export function openGrabBooking(): Promise<GrabHandoffResult> {
  if (pendingHandoff) {
    return pendingHandoff;
  }

  pendingHandoff = performGrabHandoff().finally(() => {
    pendingHandoff = null;
  });

  return pendingHandoff;
}
