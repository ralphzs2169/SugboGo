import { getBusinessCardWidth } from "../newBusinessCard";

describe("business card presentation width", () => {
  it("uses 84 percent of a phone screen for the featured variant", () => {
    expect(getBusinessCardWidth(375, "featured")).toBe(315);
  });

  it("preserves the existing default card width", () => {
    expect(getBusinessCardWidth(400)).toBe(226);
  });

  it("caps featured cards on wider layouts", () => {
    expect(getBusinessCardWidth(800, "featured")).toBe(360);
  });
});
