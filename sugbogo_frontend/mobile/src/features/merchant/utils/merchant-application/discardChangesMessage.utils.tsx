import { Text } from "react-native";

type DiscardChangesMessageProps = {
  sections: string[];
};

/**
 * Displays the confirmation message for leaving the registration
 * with unsaved changes.
 */
export default function DiscardChangesMessage({
  sections,
}: DiscardChangesMessageProps) {
  if (sections.length === 1) {
    return (
      <Text className="text-sm leading-5 mt-2 text-text-secondary">
        You have unsaved changes in{" "}
        <Text className="font-bold text-text-primary">{sections[0]}</Text>. If
        you leave now, those changes will be lost.
      </Text>
    );
  }

  return (
    <Text className="text-sm leading-5  mt-2 text-text-secondary">
      You have unsaved changes in:
      {"\n\n"}
      {sections.map((section) => (
        <Text key={section}>
          • <Text className="font-bold text-text-primary">{section}</Text>
          {"\n"}
        </Text>
      ))}
      {"\n"}
      If you leave now, those changes will be lost.
    </Text>
  );
}
