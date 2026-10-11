import assert from "node:assert/strict";
import test from "node:test";

import {
  withClusterDisplay,
  withSpecialtyDisplay,
} from "./classificationDisplay.js";

test("fills missing visuals by tag ID while keeping the submitted name", () => {
  const snapshot = { id: 12, name: "Original specialty" };
  const metadata = {
    12: { id: 12, name: "Renamed specialty", color: "teal", icon: "sparkles" },
  };

  assert.deepEqual(withSpecialtyDisplay(snapshot, metadata), {
    id: 12,
    name: "Original specialty",
    color: "teal",
    icon: "sparkles",
  });
});

test("keeps visuals already supplied by the request snapshot", () => {
  const snapshot = {
    id: 12,
    name: "Original specialty",
    color: "red",
    icon: "heart",
  };
  const metadata = {
    12: { color: "teal", icon: "sparkles" },
  };

  assert.deepEqual(withSpecialtyDisplay(snapshot, metadata), snapshot);
});

test("fills a missing cluster icon without replacing its captured name", () => {
  const snapshot = { id: 4, name: "Original cluster" };
  const metadata = {
    4: { id: 4, name: "Renamed cluster", icon: "palette" },
  };

  assert.deepEqual(withClusterDisplay(snapshot, metadata), {
    id: 4,
    name: "Original cluster",
    icon: "palette",
  });
});

test("keeps an icon already supplied by the cluster snapshot", () => {
  const snapshot = { id: 4, name: "Original cluster", icon: "coffee" };

  assert.deepEqual(
    withClusterDisplay(snapshot, { 4: { icon: "palette" } }),
    snapshot,
  );
});
