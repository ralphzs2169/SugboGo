import type { MerchantBusinessProfileResponse } from "../types/merchantBusinessProfile.types";

export function classificationHasChanged(
  business: MerchantBusinessProfileResponse,
  categoryId: number,
  specialtyTagIds: number[],
) {
  const currentTags = new Set(business.specialty_tags.map((tag) => tag.id));
  const proposedTags = new Set(specialtyTagIds);

  return (
    categoryId !== business.category.id ||
    currentTags.size !== proposedTags.size ||
    [...proposedTags].some((id) => !currentTags.has(id))
  );
}
