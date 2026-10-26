const {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} = jest.requireActual("node:fs");
const { tmpdir } = jest.requireActual("node:os");
const { join } = jest.requireActual("node:path");

const { applyMapClusteringSpiralFix } = jest.requireActual<{
  applyMapClusteringSpiralFix: (directory: string) => boolean;
}>("../../../../../scripts/fix-map-clustering-spiral.cjs");

// Minimal upstream source contract for install-script tests. Actual expansion
// behavior is exercised against the installed library by the component suite.
const upstreamSource = [
  "  let start = 0;",
  "",
  "  for (let i = 0; i < index; i++) {",
  "    start += markers[i].properties.point_count || 0;",
  "  }",
  "  if (clusterChildren[i + start]) {",
  "    const originalChildIndex = clusterChildren[i + start].properties.index;",
  "  }",
].join("\n");

let directory: string;
let helperPath: string;
let manifestPath: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), "sugbogo-clustering-patch-"));
  mkdirSync(join(directory, "lib"));
  helperPath = join(directory, "lib", "helpers.js");
  manifestPath = join(directory, "package.json");
  writeFileSync(manifestPath, JSON.stringify({ version: "4.0.0" }));
  writeFileSync(helperPath, upstreamSource);
});

afterEach(() => {
  unlinkSync(helperPath);
  unlinkSync(manifestPath);
  rmdirSync(join(directory, "lib"));
  rmdirSync(directory);
});

it.each(["\n", "\r\n"])(
  "applies after fresh installs, preserves original child identity, and is idempotent (%j)",
  (newline) => {
    const source = upstreamSource.replace(/\n/g, newline);
    writeFileSync(helperPath, source);
    expect(applyMapClusteringSpiralFix(directory)).toBe(true);
    const corrected = readFileSync(helperPath, "utf8");
    expect(corrected).toContain("clusterChildren[i].properties.index");
    expect(corrected).not.toContain("clusterChildren[i + start]");
    expect(corrected).not.toContain("start +=");
    expect(applyMapClusteringSpiralFix(directory)).toBe(false);
    expect(readFileSync(helperPath, "utf8")).toBe(corrected);
    // A dependency reinstall replaces helpers.js with the original source.
    writeFileSync(helperPath, source);
    expect(applyMapClusteringSpiralFix(directory)).toBe(true);
    expect(readFileSync(helperPath, "utf8")).toBe(corrected);
  },
);

it("fails without modifying an unexpected dependency version", () => {
  writeFileSync(manifestPath, JSON.stringify({ version: "4.1.0" }));
  expect(() => applyMapClusteringSpiralFix(directory)).toThrow(/upgrading/);
  expect(readFileSync(helperPath, "utf8")).toBe(upstreamSource);
});

it("fails without modifying unexpected helper source", () => {
  writeFileSync(helperPath, "changed upstream implementation");
  expect(() => applyMapClusteringSpiralFix(directory)).toThrow(/source/);
  expect(readFileSync(helperPath, "utf8")).toBe("changed upstream implementation");
});
