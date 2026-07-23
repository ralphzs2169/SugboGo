import { ReactNode, Children } from "react";
import { View, Text } from "react-native";

type ProfileMenuSectionProps = {
  title?: string;
  children: ReactNode;
};

/**
 * ProfileMenuSection component represents a section in the profile menu.
 * It displays a title and a list of ProfileMenuItem components.
 * @param {title} title - The title of the menu section.
 * @param {children} children - The ProfileMenuItem components to be displayed in the section.
 * @returns {JSX.Element} The rendered ProfileMenuSection component.
 */
export default function ProfileMenuSection({
  title,
  children,
}: ProfileMenuSectionProps) {
  const items = Children.toArray(children);

  return (
    <View className="mt-6">
      {title ? (
        <Text className="mb-3 px-1 text-sm font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </Text>
      ) : null}

      <View className="overflow-hidden  py-2 rounded-md bg-surface">
        {items.map((child, index) => (
          <View key={index}>
            {child}

            {/* {index < items.length - 1 && (
              <View className="ml-16 h-px bg-border mr-6" />
            )} */}
          </View>
        ))}
      </View>
    </View>
  );
}
