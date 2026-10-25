import assert from "node:assert/strict";
import test from "node:test";

import { getTransitMapNotice } from "./transitMapStatus.js";

const ready = {
  config: { apiKey: "test-key-never-display", mapId: "test-map" },
  apiStatus: "LOADED",
  markersAvailable: true,
};

test("requires a browser key even if another script reports Maps loaded", () => {
  const notice = getTransitMapNotice({ ...ready, config: { apiKey: "", mapId: "DEMO_MAP_ID" } });
  assert.equal(notice.kind, "error");
  assert.match(notice.description, /VITE_GOOGLE_MAPS_API_KEY/);
});

test("requires a map ID before attempting route marker placement", () => {
  const notice = getTransitMapNotice({ ...ready, config: { apiKey: "key", mapId: "" } });
  assert.equal(notice.title, "Map ID needed");
});

test("auth failure remains an error even when previous map capabilities were ready", () => {
  const notice = getTransitMapNotice({ ...ready, apiStatus: "AUTH_FAILURE" });
  assert.equal(notice.kind, "error");
  assert.match(notice.description, /exact Google error/);
  assert.doesNotMatch(JSON.stringify(notice), /test-key-never-display/);
});

test("script failures explain connection recovery instead of suggesting empty route data", () => {
  const notice = getTransitMapNotice({ ...ready, apiStatus: "FAILED" });
  assert.equal(notice.kind, "error");
  assert.match(notice.description, /connection/);
});

test("script and marker initialization wait, then offer recovery after timeout", () => {
  for (const state of [
    { ...ready, apiStatus: "NOT_LOADED" },
    { ...ready, apiStatus: "LOADING" },
    { ...ready, markersAvailable: null },
  ]) {
    assert.equal(getTransitMapNotice(state).kind, "loading");
    const timeout = getTransitMapNotice({ ...state, timedOut: true });
    assert.equal(timeout.kind, "error");
    assert.match(timeout.description, /unsaved work/);
  }
});

test("unavailable markers block interaction even with a loaded base map", () => {
  const notice = getTransitMapNotice({ ...ready, markersAvailable: false });
  assert.equal(notice.kind, "error");
  assert.match(notice.description, /paused/);
});

test("successful late loading recovers from a timeout or earlier capability failure", () => {
  assert.equal(getTransitMapNotice({ ...ready, timedOut: true }), null);
  assert.equal(getTransitMapNotice(ready), null);
});
