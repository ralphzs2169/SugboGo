import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";
import {
  classificationHasChanged,
  mergeClassificationSpecialtyOptions,
} from "../classificationChange.utils";

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

describe("mergeClassificationSpecialtyOptions", () => {
  const tag = (id: number, name = `Tag ${id}`) => ({
    id,
    name,
    color: "blue" as const,
    icon: "tag" as const,
  });

  it("shows all current live tags first when the lookup contains only one of them", () => {
    const options = mergeClassificationSpecialtyOptions(
      [tag(3, "Lookup C"), tag(4), tag(5)],
      [tag(1), tag(2), tag(3, "Current C")],
    );

    expect(options.map((option) => option.id)).toEqual([1, 2, 3, 4, 5]);
    expect(options.find((option) => option.id === 3)?.name).toBe("Current C");
  });

  it("deduplicates tags already returned by the lookup", () => {
    const options = mergeClassificationSpecialtyOptions(
      [tag(1), tag(2), tag(3), tag(4), tag(3)],
      [tag(1), tag(2), tag(3)],
    );

    expect(options.map((option) => option.id)).toEqual([1, 2, 3, 4]);
  });

  it("normalizes equivalent numeric and string IDs", () => {
    const options = mergeClassificationSpecialtyOptions(
      [tag(3), tag(4)],
      [tag(1), tag(2), { ...tag(3), id: "3" as unknown as number }],
    );

    expect(options.map((option) => option.id)).toEqual([1, 2, 3, 4]);
  });
});
