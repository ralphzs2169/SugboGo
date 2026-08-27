import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";
import FixedFooter from "@/shared/components/FixedFooter";

type Props = {
  isOwnBusiness: boolean;
  hasOwnReview: boolean;
  onGetDirections: () => void;
  onWriteReview: () => void;
};

/**
 * Provides the contextual actions for an Explorer viewing a business.
 *
 * Keeps action positions consistent across screens while changing the visual
 * priority of the actions based on the current screen.
 */
export default function BusinessProfileFooter({
  isOwnBusiness,
  hasOwnReview,
  onGetDirections,
  onWriteReview,
}: Props) {
  if (isOwnBusiness) {
    return (
      <FixedFooter>
        <Button
          title="Manage My Business"
          onPress={() => router.push("/(merchant)/(tabs)/profile")}
          icon={
            <MaterialCommunityIcons
              name="cog-outline"
              size={18}
              color="white"
            />
          }
          rounded="full"
          className="w-full"
          fontClassName="text-sm font-semibold"
        />
      </FixedFooter>
    );
  }

  if (hasOwnReview) {
    return (
      <FixedFooter>
        <Button
          title="Get Directions"
          onPress={onGetDirections}
          icon={
            <MaterialCommunityIcons
              name="navigation-outline"
              size={18}
              color="white"
            />
          }
          rounded="full"
          className="w-full"
          fontClassName="text-sm font-semibold"
        />
      </FixedFooter>
    );
  }

  return (
    <FixedFooter>
      <View className="flex-row gap-3">
        <Button
          title="Get Directions"
          onPress={onGetDirections}
          variant="soft"
          icon={
            <MaterialCommunityIcons
              name="navigation-outline"
              size={18}
              color={theme.extends.colors.brand}
            />
          }
          rounded="full"
          className="flex-1"
          fontClassName="text-sm font-semibold"
        />
        <Button
          title="Write a Review"
          onPress={onWriteReview}
          icon={
            <MaterialCommunityIcons
              name="comment-edit-outline"
              size={18}
              color="white"
            />
          }
          rounded="full"
          className="flex-1"
          fontClassName="text-sm font-semibold"
        />
      </View>
    </FixedFooter>
  );
}
