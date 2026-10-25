import assert from "node:assert/strict";
import test from "node:test";

import { resolveGoogleMapsConfig } from "./googleMapsConfig.js";

test("uses the supplied browser key and JavaScript map ID after trimming", () => {
  assert.deepEqual(resolveGoogleMapsConfig({
    VITE_GOOGLE_MAPS_API_KEY: " browser-test-key ",
    VITE_GOOGLE_MAP_ID: " configured-map-id ",
    DEV: true,
  }), { apiKey: "browser-test-key", mapId: "configured-map-id" });
});

test("local development can use advanced markers without a private map ID", () => {
  assert.deepEqual(resolveGoogleMapsConfig({ DEV: true }), {
    apiKey: "",
    mapId: "DEMO_MAP_ID",
  });
});

test("production never silently substitutes the development map ID", () => {
  assert.equal(resolveGoogleMapsConfig({ DEV: false }).mapId, "");
  assert.equal(resolveGoogleMapsConfig({ DEV: "true" }).mapId, "");
  assert.equal(resolveGoogleMapsConfig().mapId, "");
});

test("does not borrow backend credentials or accept whitespace as a browser key", () => {
  const config = resolveGoogleMapsConfig({
    GOOGLE_MAPS_API_KEY: "server-only-key",
    VITE_GOOGLE_MAPS_API_KEY: "   ",
  });
  assert.equal(config.apiKey, "");
});
