const { readFileSync, writeFileSync } = require("node:fs");
const { dirname, join } = require("node:path");

const LOCAL_LEAVES_COMMENT =
  "  // SugboGo: getLeaves() already returns this cluster's local leaves.";
const DEFECTIVE_OFFSET = [
  "  let start = 0;",
  "",
  "  for (let i = 0; i < index; i++) {",
  "    start += markers[i].properties.point_count || 0;",
  "  }",
].join("\n");

/**
 * Narrow install-time correction for react-native-map-clustering 4.0.0.
 * ClusteredMapView supplies local leaves, so generateSpiral must use local indexes.
 * Keep the spiral geometry, original child indexes, and all other behavior intact.
 *
 * npm install/ci runs this automatically. After --ignore-scripts, run this file
 * explicitly. Revisit/remove the patch when upgrading the dependency, using the
 * BusinessDiscoveryMapClustering regression tests to verify upstream behavior.
 */
function applyMapClusteringSpiralFix(packageDirectory) {
  const manifest = JSON.parse(
    readFileSync(join(packageDirectory, "package.json"), "utf8"),
  );
  if (manifest.version !== "4.0.0") {
    throw new Error(
      "Review the Map spiral fix before upgrading react-native-map-clustering.",
    );
  }

  const helperPath = join(packageDirectory, "lib", "helpers.js");
  const original = readFileSync(helperPath, "utf8");
  const source = original.replace(/\r\n/g, "\n");
  if (
    source.includes(LOCAL_LEAVES_COMMENT) &&
    !source.includes(DEFECTIVE_OFFSET) &&
    !source.includes("clusterChildren[i + start]")
  ) {
    return false;
  }
  if (
    !source.includes(DEFECTIVE_OFFSET) ||
    source.split("clusterChildren[i + start]").length !== 3
  ) {
    throw new Error(
      "Unexpected clustering helper source; review the Map spiral fix.",
    );
  }

  const corrected = source
    .replace(DEFECTIVE_OFFSET, LOCAL_LEAVES_COMMENT)
    .replaceAll("clusterChildren[i + start]", "clusterChildren[i]");
  writeFileSync(
    helperPath,
    original.includes("\r\n") ? corrected.replace(/\n/g, "\r\n") : corrected,
  );
  return true;
}

module.exports = { applyMapClusteringSpiralFix };

if (require.main === module) {
  const packageDirectory = dirname(
    require.resolve("react-native-map-clustering/package.json"),
  );
  applyMapClusteringSpiralFix(packageDirectory);
}
