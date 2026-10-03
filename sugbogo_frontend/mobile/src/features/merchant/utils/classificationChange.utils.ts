import type { MerchantBusinessProfileResponse } from "../types/merchantBusinessProfile.types";
import type { SpecialtyTag } from "@/shared/types/specialtyTag.types";

type LiveSpecialty = MerchantBusinessProfileResponse["specialty_tags"][number];
type SpecialtyOption = SpecialtyTag & { id: number; name: string };

/** Keeps live specialties visible first, even when the lookup omits them. */
export function mergeClassificationSpecialtyOptions(
  lookupTags: SpecialtyOption[],
  liveTags: LiveSpecialty[],
) {
  const options = new Map<number, SpecialtyOption>();

  for (const tag of [...liveTags, ...lookupTags]) {
    const id = Number(tag.id);
    if (Number.isInteger(id) && id > 0 && !options.has(id)) {
      options.set(id, { ...tag, id });
    }
  }

  return [...options.values()];
}

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
