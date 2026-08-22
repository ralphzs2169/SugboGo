import { ReactNode, Children } from "react";
import { View, Text } from "react-native";

type ProfileMenuSectionProps = {
  title?: string;
  children: ReactNode;
};

/**
 * ProfileMenuSection component represents a section in the profile menu.
 * It displays a title and a list of ProfileMenuItem components.
 */
export default function ProfileMenuSection({
  title,
  children,
}: ProfileMenuSectionProps) {
  const items = Children.toArray(children);

  return (
    <View className="mt-3">
      <View className="overflow-hidden pt-6 pb-4 rounded-md bg-surface">
        {title ? (
          <Text className="mb-3 px-5 text-sm font-semibold  text-text-secondary">
            {title}
          </Text>
        ) : null}
        {items.map((child, index) => (
          <View key={index}>
            {child}

            {/* {index < items.length - 1 && (
              <View className="ml-16 h-px bg-border-primary mr-6" />
            )} */}
          </View>
        ))}
      </View>
    </View>
  );
}
