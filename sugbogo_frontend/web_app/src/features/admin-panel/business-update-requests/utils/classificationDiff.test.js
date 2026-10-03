import test from "node:test";
import assert from "node:assert/strict";

import {
  classificationMatches,
  getClassificationDiff,
  hasStalePendingBaseline,
} from "./classificationDiff.js";

const tag = (id, name) => ({ id, name });

function classification(categoryId, clusterId, tags) {
  return {
    category: { id: categoryId, name: `Category ${categoryId}` },
    cluster: { id: clusterId, name: `Cluster ${clusterId}` },
    specialty_tags: tags,
  };
}

test("specialty changes use IDs and preserve removed, retained, and added groups", () => {
  const previous = classification(1, 10, [
    tag(1, "A"),
    tag(2, "B"),
    tag(3, "C"),
  ]);
  const proposed = classification(1, 10, [
    tag("3", "C renamed"),
    tag(2, "B"),
    tag(4, "D"),
  ]);

  const diff = getClassificationDiff(previous, proposed);

  assert.equal(diff.categoryChanged, false);
  assert.equal(diff.clusterChanged, false);
  assert.deepEqual(
    diff.removedSpecialties.map((item) => item.id),
    [1],
  );
  assert.deepEqual(
    diff.retainedSpecialties.map((item) => item.id),
    ["3", 2],
  );
  assert.deepEqual(
    diff.addedSpecialties.map((item) => item.id),
    [4],
  );
});

test("category and cluster changes are reported independently", () => {
  const previous = classification(1, 10, []);
  const sameCluster = classification(2, 10, []);
  const newCluster = classification(2, 11, []);

  assert.equal(
    getClassificationDiff(previous, sameCluster).categoryChanged,
    true,
  );
  assert.equal(
    getClassificationDiff(previous, sameCluster).clusterChanged,
    false,
  );
  assert.equal(
    getClassificationDiff(previous, newCluster).clusterChanged,
    true,
  );
});

test("stale comparison ignores specialty order and labels but detects changed IDs", () => {
  const submitted = classification(1, 10, [tag(1, "A"), tag(2, "B")]);
  const reordered = classification("1", "10", [
    tag("2", "Renamed"),
    tag(1, "A"),
  ]);
  const changedTags = classification(1, 10, [tag(1, "A"), tag(3, "C")]);
  const changedCategory = classification(2, 10, submitted.specialty_tags);
  const changedCluster = classification(1, 11, submitted.specialty_tags);

  assert.equal(classificationMatches(reordered, submitted), true);
  assert.equal(classificationMatches(changedTags, submitted), false);
  assert.equal(classificationMatches(changedCategory, submitted), false);
  assert.equal(classificationMatches(changedCluster, submitted), false);
  assert.equal(
    hasStalePendingBaseline({
      status: "pending",
      current: changedTags,
      previous: submitted,
    }),
    true,
  );
  assert.equal(
    hasStalePendingBaseline({
      status: "approved",
      current: changedTags,
      previous: submitted,
    }),
    false,
  );
});
