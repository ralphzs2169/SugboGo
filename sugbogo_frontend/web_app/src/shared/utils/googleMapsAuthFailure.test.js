import assert from "node:assert/strict";
import test from "node:test";

import { listenForGoogleMapsAuthFailure } from "./googleMapsAuthFailure.js";

test("Google auth failure reaches the map even after the script loaded", () => {
  const target = {};
  let failed = false;
  const cleanup = listenForGoogleMapsAuthFailure(target, () => { failed = true; });
  target.gm_authFailure();
  assert.equal(failed, true);
  cleanup();
  assert.equal(Object.hasOwn(target, "gm_authFailure"), false);
});

test("preserves an existing auth listener and restores it on cleanup", () => {
  const calls = [];
  const previous = () => calls.push("existing");
  const target = { gm_authFailure: previous };
  const cleanup = listenForGoogleMapsAuthFailure(target, () => calls.push("transit"));
  target.gm_authFailure();
  assert.deepEqual(calls, ["transit", "existing"]);
  cleanup();
  assert.equal(target.gm_authFailure, previous);
});

test("cleanup does not overwrite a listener registered by a later owner", () => {
  const target = {};
  const cleanup = listenForGoogleMapsAuthFailure(target, () => {});
  const later = () => {};
  target.gm_authFailure = later;
  cleanup();
  assert.equal(target.gm_authFailure, later);
});
