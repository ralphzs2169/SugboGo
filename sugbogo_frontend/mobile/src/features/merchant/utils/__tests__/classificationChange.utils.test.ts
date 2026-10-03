import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import { classificationHasChanged } from "../classificationChange.utils";

const business = {
  category: { id: 2, name: "Restaurants" },
  specialty_tags: [{ id: 1 }, { id: 2 }, { id: 3 }],
} as MerchantBusinessProfileResponse;

describe("classificationHasChanged", () => {
  it("treats the specialty set as unordered", () => {
    expect(classificationHasChanged(business, 2, [3, 1, 2])).toBe(false);
  });

  it("allows category-only and specialty-only proposals", () => {
    expect(classificationHasChanged(business, 4, [1, 2, 3])).toBe(true);
    expect(classificationHasChanged(business, 2, [1, 2, 4])).toBe(true);
  });

  it("handles a live business with fewer than three specialties", () => {
    expect(
      classificationHasChanged(
        { ...business, specialty_tags: [{ id: 1 } as any] },
        2,
        [1, 2, 3],
      ),
    ).toBe(true);
  });
});
