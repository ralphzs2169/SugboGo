/** Resolve browser Maps settings without borrowing a server or mobile API key. */
export function resolveGoogleMapsConfig(env = {}) {
  const apiKey = (env.VITE_GOOGLE_MAPS_API_KEY ?? "").trim();
  const configuredMapId = (env.VITE_GOOGLE_MAP_ID ?? "").trim();

  return {
    apiKey,
    mapId: configuredMapId || (env.DEV === true ? "DEMO_MAP_ID" : ""),
  };
}

export const googleMapsConfig = resolveGoogleMapsConfig(import.meta.env ?? {});
