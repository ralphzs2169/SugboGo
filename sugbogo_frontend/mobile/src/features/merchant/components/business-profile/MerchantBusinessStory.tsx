import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import BusinessAboutContent from "@/features/explore/components/business-profile/BusinessAboutContent";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";

type Props = {
  business: MerchantBusinessProfileResponse;
  onEditInformation?: () => void;
};

/**
 * Presents the business introduction and specialties below the overview.
 * Keeps direct information editing adjacent to approved business content.
 */
export default function MerchantBusinessStory({
  business,
  onEditInformation,
}: Props) {
  const canEdit = business.status === "active";

  return (
    <View className="mt-2 bg-surface px-5 pb-5 pt-4">
      {/* Business introduction */}
      <View className="flex-row items-center justify-between gap-3">
        <AppText weight="bold" className="flex-1 text-base text-text-primary">
          About your business
        </AppText>
        {canEdit && onEditInformation ? (
          <Pressable
            onPress={onEditInformation}
            accessibilityRole="button"
            accessibilityLabel="Edit business information"
            className="min-h-11 cursor-pointer flex-row items-center gap-1 px-2 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Edit
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.brand}
            />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-1">
        {business.description?.trim() ? (
          <BusinessAboutContent description={business.description.trim()} />
        ) : (
          <AppText className="text-sm text-text-secondary">
            No description added yet
          </AppText>
        )}
      </View>

      {/* Live specialties */}
      {business.specialty_tags.length > 0 ? (
        <View className="mt-4 border-t border-border-primary/60 pt-4">
          <AppText weight="semibold" className="text-xs text-text-secondary">
            Specialties
          </AppText>
          <View className="mt-2 flex-row flex-wrap gap-1">
            {business.specialty_tags.map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} size="small" showIcon />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
