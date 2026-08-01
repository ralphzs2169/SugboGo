import { isDuplicateLandmarkName } from "../duplicateLandmark";

const landmarks = [
  {
    id: "1",
    name: "SM City Cebu",
  },
  {
    id: "2",
    name: "Ayala Center Cebu",
  },
] as any;

describe("isDuplicateLandmarkName", () => {
  it("returns true for an exact match", () => {
    expect(isDuplicateLandmarkName("SM City Cebu", landmarks)).toBe(true);
  });

  it("ignores case differences", () => {
    expect(isDuplicateLandmarkName("sm city cebu", landmarks)).toBe(true);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(isDuplicateLandmarkName("   SM City Cebu   ", landmarks)).toBe(true);
  });

  it("returns false for a unique name", () => {
    expect(isDuplicateLandmarkName("IT Park", landmarks)).toBe(false);
  });

  it("returns false when no landmarks exist", () => {
    expect(isDuplicateLandmarkName("IT Park", [])).toBe(false);
  });
});
