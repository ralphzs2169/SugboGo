import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { theme } from "@/constants/theme";
import Button from "@/shared/components/Button";

type ErrorStateProps = {
  title: string;
  description: string;

  primaryActionTitle?: string;
  onPrimaryAction?: () => void;

  secondaryActionTitle?: string;
  onSecondaryAction?: () => void;
};

export default function ErrorState({
  title,
  description,
  primaryActionTitle,
  onPrimaryAction,
  secondaryActionTitle,
  onSecondaryAction,
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <MaterialCommunityIcons
        name="cloud-off-outline"
        size={88}
        color={theme.extends.colors.text.tertiary}
      />

      <Text className="mt-6 text-center text-2xl font-bold text-text-primary">
        {title}
      </Text>

      <Text className="mt-2 text-center text-base leading-6 text-text-secondary">
        {description}
      </Text>

      {(primaryActionTitle || secondaryActionTitle) && (
        <View className="mt-8 w-full gap-3">
          {primaryActionTitle && onPrimaryAction && (
            <Button
              title={primaryActionTitle}
              onPress={onPrimaryAction}
              fontClassName="font-bold"
            />
          )}

          {secondaryActionTitle && onSecondaryAction && (
            <Button
              title={secondaryActionTitle}
              variant="outline"
              onPress={onSecondaryAction}
            />
          )}
        </View>
      )}
    </View>
  );
}
