import { APIProvider } from "@vis.gl/react-google-maps";

/**
 * Provides the Google Maps JavaScript API to web map components.
 *
 * Centralizes API loading configuration for the admin web application.
 */
export default function GoogleMapsProvider({ children }) {
  return (
    <APIProvider
      apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY}
      region="PH"
      language="en"
    >
      {children}
    </APIProvider>
  );
}
