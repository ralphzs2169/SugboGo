import { View, Text, Modal, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

type Props = {
  visible: boolean;
  currentTag: string;
  availableTags: string[];
  onConfirm: (newTag: string) => void;
  onClose: () => void;
};

export default function EditVouchModal({
  visible,
  currentTag,
  availableTags,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/40 justify-end"
        onPress={onClose}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="rounded-t-2xl bg-surface p-4 pb-8"
        >
          <View className="items-center mb-4">
            <View className="h-1 w-10 rounded-full bg-disabled" />
          </View>

          <Text className="text-base font-bold text-text-primary mb-1">
            Change Vouch
          </Text>
          <Text className="text-sm text-text-secondary mb-4">
            Select a different specialty to vouch for.
          </Text>

          {availableTags.map((tag) => {
            const isSelected = tag === currentTag;
            return (
              <Pressable
                key={tag}
                onPress={() => onConfirm(tag)}
                className={`flex-row items-center justify-between rounded-md border px-4 py-3 mb-2 ${
                  isSelected ? "border-brand bg-orange-50" : "border-border"
                }`}
              >
                <Text
                  className={`text-sm font-medium ${
                    isSelected ? "text-brand" : "text-text-primary"
                  }`}
                >
                  {tag}
                </Text>
                {isSelected && (
                  <MaterialCommunityIcons name="check" size={18} color="#F27F0D" />
                )}
              </Pressable>
            );
          })}

          <Pressable
            onPress={onClose}
            className="mt-2 items-center rounded-md py-3"
          >
            <Text className="text-sm font-semibold text-text-secondary">
              Cancel
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}