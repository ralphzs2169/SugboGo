import {
  validateLandmarkName,
  MAX_LANDMARK_NAME_LENGTH,
} from "../customLandmark";

describe("validateLandmarkName", () => {
  it("returns an error when the name is empty", () => {
    expect(validateLandmarkName("")).toEqual({
      name: "Please enter a landmark name.",
    });
  });

  it("returns an error when the name only contains spaces", () => {
    expect(validateLandmarkName("     ")).toEqual({
      name: "Please enter a landmark name.",
    });
  });

  it("returns an error when the name exceeds the maximum length", () => {
    const longName = "A".repeat(MAX_LANDMARK_NAME_LENGTH + 1);

    expect(validateLandmarkName(longName)).toEqual({
      name: `Landmark names must be ${MAX_LANDMARK_NAME_LENGTH} characters or less.`,
    });
  });

  it("accepts a valid landmark name", () => {
    expect(validateLandmarkName("Ayala Center Cebu")).toEqual({});
  });

  it("accepts a name exactly at the maximum length", () => {
    const name = "A".repeat(MAX_LANDMARK_NAME_LENGTH);

    expect(validateLandmarkName(name)).toEqual({});
  });

  it("ignores leading and trailing whitespace", () => {
    expect(validateLandmarkName("   Ayala Center Cebu   ")).toEqual({});
  });

  it("treats multiple spaces as valid", () => {
    expect(validateLandmarkName("Ayala    Center    Cebu")).toEqual({});
  });
});
