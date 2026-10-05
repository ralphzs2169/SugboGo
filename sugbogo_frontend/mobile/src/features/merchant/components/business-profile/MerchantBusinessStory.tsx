import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import BusinessAboutContent from "@/features/explore/components/business-profile/BusinessAboutContent";
import AppText from "@/shared/components/AppText";
import SpecialtyTagChip from "@/shared/components/SpecialtyTagChip";
import type { ClassificationChangeRequest } from "../../types/classificationChange.types";
import type { MerchantBusinessProfileResponse } from "../../types/merchantBusinessProfile.types";

type Props = {
  business: MerchantBusinessProfileResponse;
  pendingClassificationRequest?: ClassificationChangeRequest | null;
  isCheckingClassification?: boolean;
  hasClassificationError?: boolean;
  onClassificationHistory?: () => void;
  onRetryClassification?: () => void;
  onEditInformation?: () => void;
};

/**
 * Completes the business identity beneath the cover with specialties and
 * a concise introduction. Reviewed changes remain contextual to that identity.
 */
export default function MerchantBusinessStory({
  business,
  pendingClassificationRequest,
  isCheckingClassification,
  hasClassificationError,
  onClassificationHistory,
  onRetryClassification,
  onEditInformation,
}: Props) {
  const canEdit = business.status === "active";

  return (
    <View className="px-5 pb-1 pt-1">
      {/* Business specialties and review state */}
      {business.specialty_tags.length > 0 ? (
        <View>
          <AppText weight="semibold" className="text-xs text-text-secondary">
            Specialties
          </AppText>
          <View className="mt-2 flex-row flex-wrap">
            {business.specialty_tags.map((tag) => (
              <SpecialtyTagChip key={tag.id} tag={tag} size="small" showIcon />
            ))}
          </View>
        </View>
      ) : null}
      {pendingClassificationRequest ? (
        <Pressable
          onPress={onClassificationHistory}
          accessibilityRole="button"
          accessibilityLabel="View pending classification request"
          className="mt-1 min-h-11 cursor-pointer flex-row items-center self-start active:opacity-70"
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={theme.extends.colors.text.secondary}
          />
          <AppText className="ml-1.5 text-xs text-text-secondary">
            Classification pending review
          </AppText>
          <MaterialCommunityIcons
            name="chevron-right"
            size={16}
            color={theme.extends.colors.text.secondary}
          />
        </Pressable>
      ) : null}
      {isCheckingClassification ? (
        <AppText className="mt-2 text-xs text-text-secondary">
          Checking request status...
        </AppText>
      ) : hasClassificationError ? (
        <Pressable
          onPress={onRetryClassification}
          accessibilityRole="button"
          className="min-h-11 cursor-pointer justify-center"
        >
          <AppText className="text-sm text-brand">Retry request status</AppText>
        </Pressable>
      ) : null}

      {/* Short business introduction */}
      <View className="mt-2 flex-row items-center justify-between gap-3">
        <AppText weight="semibold" className="text-sm text-text-primary">
          About
        </AppText>
        {canEdit && onEditInformation ? (
          <Pressable
            onPress={onEditInformation}
            accessibilityRole="button"
            accessibilityLabel="Edit business information"
            className="min-h-11 cursor-pointer flex-row items-center px-2 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-brand">
              Edit
            </AppText>
            <MaterialCommunityIcons
              name="chevron-right"
              size={18}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        ) : null}
      </View>
      {business.description?.trim() ? (
        <BusinessAboutContent description={business.description.trim()} />
      ) : (
        <AppText className="text-sm text-text-secondary">
          No description added yet
        </AppText>
      )}
    </View>
  );
}
