import assert from "node:assert/strict";
import test from "node:test";

import {
  groupLocationMapStates,
  validLocationPosition,
} from "./locationMapMarkers.js";

test("keeps exact and nearby positions distinct unless coordinates coincide", () => {
  const states = [
    {
      id: "previous",
      location: { latitude: "10.315700", longitude: "123.885400" },
    },
    {
      id: "proposed",
      location: { latitude: 10.3157, longitude: 123.8854 },
    },
    {
      id: "current",
      location: { latitude: 10.315701, longitude: 123.8854 },
    },
  ];

  const groups = groupLocationMapStates(states);

  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].position, { lat: 10.3157, lng: 123.8854 });
  assert.deepEqual(
    groups[0].states.map((state) => state.id),
    ["previous", "proposed"],
  );
  assert.deepEqual(
    groups[1].states.map((state) => state.id),
    ["current"],
  );
});

test("omits invalid coordinates without inventing positions", () => {
  assert.equal(validLocationPosition({ latitude: "", longitude: 123 }), null);
  assert.equal(validLocationPosition({ latitude: 91, longitude: 123 }), null);
  assert.equal(validLocationPosition({ latitude: 10, longitude: null }), null);
  assert.deepEqual(
    groupLocationMapStates([
      { id: "invalid", location: { latitude: "north", longitude: 123 } },
      { id: "valid", location: { latitude: 10, longitude: 123 } },
    ]).map((group) => group.states[0].id),
    ["valid"],
  );
});
