import { APIProvider } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";
import { googleMapsConfig } from "@/shared/utils/googleMapsConfig";
import { GoogleMapsAuthContext } from "@/shared/utils/googleMapsAuthContext";
import { listenForGoogleMapsAuthFailure } from "@/shared/utils/googleMapsAuthFailure";

/**
 * Provides the Google Maps JavaScript API to web map components.
 *
 * Centralizes API loading configuration for the admin web application.
 */
export default function GoogleMapsProvider({ children }) {
  const [authFailed, setAuthFailed] = useState(false);

  useEffect(
    () => listenForGoogleMapsAuthFailure(window, () => setAuthFailed(true)),
    [],
  );

  return (
    <GoogleMapsAuthContext.Provider value={authFailed}>
      <APIProvider
        apiKey={googleMapsConfig.apiKey}
        region="PH"
        language="en"
      >
        {children}
      </APIProvider>
    </GoogleMapsAuthContext.Provider>
  );
}
