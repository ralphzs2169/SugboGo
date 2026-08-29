import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";

import { useReplyTemplates } from "../../../hooks/reply-templates/useReplyTemplates";
import type { ReplyTemplate } from "../../../types/reply-templates/replyTemplate.types";

type Props = {
  sheetRef: React.RefObject<BottomSheetModal | null>;
  onSelect: (template: ReplyTemplate) => void;
};

/**
 * Lets merchants choose a saved response template while composing
 * a review reply. Selecting a template returns its text to the composer
 * without modifying the saved template itself.
 */
export default function ReplyTemplatePickerSheet({
  sheetRef,
  onSelect,
}: Props) {
  const { templates, isLoading, error, refetch } = useReplyTemplates();

  const handleSelect = (template: ReplyTemplate) => {
    onSelect(template);
    sheetRef.current?.dismiss();
  };

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={["65%"]}
      enableDynamicSizing={false}
      keyboardBehavior="fillParent"
      keyboardBlurBehavior="restore"
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.45}
        />
      )}
    >
      <View className="px-5 pt-3">
        {/* Sheet header */}
        <View className="flex-row items-start">
          <View className="flex-1 pr-3">
            <Text className="text-xl font-bold text-text-primary">
              Response templates
            </Text>

            <Text className="mt-2 text-xs leading-5 text-text-secondary">
              Choose a saved response to get started.
            </Text>
          </View>

          <Pressable
            onPress={() => sheetRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel="Close response templates"
            hitSlop={8}
            className="cursor-pointer rounded-full p-1 active:opacity-60"
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.extends.colors.text.secondary}
            />
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        </View>
      ) : error ? (
        <View className="flex-1">
          <ErrorState
            size="small"
            icon="text-box-remove-outline"
            title="Unable to load templates"
            description="We couldn't load your response templates right now."
            primaryActionTitle="Retry"
            onPrimaryAction={() => {
              void refetch();
            }}
          />
        </View>
      ) : (
        <BottomSheetScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-10 pt-5"
          showsVerticalScrollIndicator={false}
        >
          {templates.length === 0 ? (
            /* Empty state */
            <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
              <MaterialCommunityIcons
                name="text-box-multiple-outline"
                size={38}
                color={theme.extends.colors.text.tertiary}
              />

              <Text className="mt-3 text-base font-bold text-text-primary">
                No response templates yet
              </Text>

              <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
                Create a template first to reuse responses when replying to
                reviews.
              </Text>
            </View>
          ) : (
            /* Template list */
            <View>
              {templates.map((template) => (
                <Pressable
                  key={template.id}
                  onPress={() => handleSelect(template)}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${template.title} template`}
                  className="mb-3 cursor-pointer rounded-card border border-border-primary bg-surface p-4 active:opacity-70"
                >
                  <View className="flex-row items-center">
                    <Text
                      className="flex-1 text-sm font-bold text-text-primary"
                      numberOfLines={1}
                    >
                      {template.title}
                    </Text>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={20}
                      color={theme.extends.colors.text.tertiary}
                    />
                  </View>

                  <Text
                    className="mt-1.5 text-sm leading-5 text-text-secondary"
                    numberOfLines={3}
                  >
                    {template.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </BottomSheetScrollView>
      )}
    </BottomSheetModal>
  );
}
