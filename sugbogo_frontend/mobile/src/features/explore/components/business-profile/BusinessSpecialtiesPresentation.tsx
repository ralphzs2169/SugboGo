import { View } from "react-native";

import AppText from "@/shared/components/AppText";
import type { ExploreBusinessSpecialtyTag } from "../../types/exploreBusiness.types";
import BusinessSpecialtyVouchCard from "./BusinessSpecialtyVouchCard";

type Tag = Pick<ExploreBusinessSpecialtyTag, "id" | "name" | "color" | "icon"> &
  Partial<Pick<ExploreBusinessSpecialtyTag, "vouch_count" | "is_vouched">>;

/** Shares the normal specialty group without owning any Vouch mutation or query. */
export default function BusinessSpecialtiesPresentation({
  tags,
  disabled = false,
  ownerPresentation = false,
  onVouch,
}: {
  tags: Tag[];
  disabled?: boolean;
  ownerPresentation?: boolean;
  onVouch?: (tagId: number) => void;
}) {
  if (!tags.length) return null;
  return (
    <View className="bg-surface px-4 py-4">
      {/* Specialty identity stays visible independently of social state. */}
      <AppText weight="bold" className="text-base text-text-primary">
        Specialties
      </AppText>
      <AppText className="mt-0.5 text-xs text-text-secondary">
        {ownerPresentation
          ? "What Explorers vouch for at your business"
          : "What does this place get right?"}
      </AppText>
      <View className="mt-3 rounded-xl bg-background px-1 py-2">
        <View className="flex-row flex-wrap items-start">
          {tags.map((tag) => (
            <BusinessSpecialtyVouchCard
              key={tag.id}
              name={tag.name}
              color={tag.color}
              icon={tag.icon}
              vouchCount={tag.vouch_count ?? null}
              isVouched={tag.is_vouched ?? null}
              disabled={disabled || !onVouch}
              onPress={onVouch ? () => onVouch(tag.id) : undefined}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
