/** Explain map failures without exposing credentials or guessing a Cloud error. */
export function getTransitMapNotice({
  config,
  apiStatus,
  markersAvailable,
  timedOut = false,
}) {
  if (!config.apiKey) {
    return {
      title: "Map setup needed",
      description:
        "Set VITE_GOOGLE_MAPS_API_KEY in the web app's local environment, then restart the web app and reload this page.",
      kind: "error",
    };
  }
  if (!config.mapId) {
    return {
      title: "Map ID needed",
      description:
        "Set VITE_GOOGLE_MAP_ID to a JavaScript map ID, then rebuild and reload the web app. Route markers need this setting.",
      kind: "error",
    };
  }
  if (apiStatus === "AUTH_FAILURE") {
    return {
      title: "Google Maps access was rejected",
      description:
        "Check the browser key, enabled Maps JavaScript API, billing and allowed website addresses in Google Cloud. See the browser console for the exact Google error.",
      kind: "error",
    };
  }
  if (apiStatus === "FAILED") {
    return {
      title: "Unable to load the map",
      description:
        "Check your connection and whether the Google Maps script is blocked. Reload this page after resolving the problem.",
      kind: "error",
    };
  }
  if (apiStatus === "LOADED" && markersAvailable === false) {
    return {
      title: "Route markers are unavailable",
      description:
        "Check the JavaScript map ID and Google Maps configuration. Point placement and route drawing are paused until markers are available.",
      kind: "error",
    };
  }
  if (apiStatus !== "LOADED" || markersAvailable !== true) {
    return {
      title: timedOut ? "The map is taking too long to load" : "Loading transit map…",
      description: timedOut
        ? "Check your connection and Google Maps configuration, then reload this page. Save or cancel any unsaved work first."
        : "Waiting for the map and route markers. Your route list remains available.",
      kind: timedOut ? "error" : "loading",
    };
  }
  return null;
}
