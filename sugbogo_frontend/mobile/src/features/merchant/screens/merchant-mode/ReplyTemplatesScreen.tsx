import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { theme } from "@/constants/theme";
import ErrorState from "@/shared/components/ErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReplyTemplates } from "../../hooks/reply-templates/useReplyTemplates";
import ReplyTemplateComposerSheet from "../../components/review-management/reply-template/ReplyTemplateComposerSheet";
import ReplyTemplateCard from "../../components/review-management/reply-template/ReplyTemplateCard";
import { ReplyTemplate } from "../../types/reply-templates/replyTemplate.types";

/**
 * Provides merchants with a dedicated space to manage reusable
 * responses that can later be inserted into review replies.
 */
export default function ReplyTemplatesScreen() {
  const router = useRouter();
  const composerRef = useRef<BottomSheetModal | null>(null);
  const insets = useSafeAreaInsets();
  const { templates, isLoading, isRefetching, error, refetch } =
    useReplyTemplates();

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ReplyTemplate | null>(null);

  const openCreateComposer = () => {
    setSelectedTemplate(null);
    composerRef.current?.present();
  };

  const openEditComposer = (template: ReplyTemplate) => {
    setSelectedTemplate(template);
    composerRef.current?.present();
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color={theme.extends.colors.brand} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          size="small"
          icon="text-box-remove-outline"
          title="Unable to load templates"
          description="We couldn't load your reply templates right now. Please try again."
          primaryActionTitle="Retry"
          onPrimaryAction={refresh}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={templates}
        keyExtractor={(template) => String(template.id)}
        renderItem={({ item }) => (
          <ReplyTemplateCard
            id={item.id}
            title={item.title}
            text={item.text}
            onEdit={() => openEditComposer(item)}
          />
        )}
        contentContainerClassName="px-4 pb-32"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
          />
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListHeaderComponent={
          <View className="pb-5">
            {/* Screen description */}
            <Text className="mt-3 px-1 text-sm leading-5 text-text-secondary">
              Save reusable responses to answer reviews faster.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View className="items-center rounded-card border border-border-primary bg-surface px-6 py-10">
            {/* Empty state */}
            <MaterialCommunityIcons
              name="text-box-multiple-outline"
              size={38}
              color={theme.extends.colors.text.tertiary}
            />

            <Text className="mt-3 text-base font-bold text-text-primary">
              No reply templates yet
            </Text>

            <Text className="mt-1 text-center text-sm leading-5 text-text-secondary">
              Create reusable responses to make replying to customers faster.
            </Text>
          </View>
        }
      />

      {/* Add template action */}
      <View
        className="absolute left-0 right-0 items-center px-4"
        style={{ bottom: insets.bottom + 16 }}
      >
        <Pressable
          onPress={openCreateComposer}
          accessibilityRole="button"
          accessibilityLabel="Add reply template"
          className="min-h-12 cursor-pointer flex-row items-center rounded-full bg-brand px-5 active:opacity-80"
        >
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />

          <Text className="ml-2 text-sm font-bold text-white">
            Add template
          </Text>
        </Pressable>
      </View>

      {/* Template composer */}
      <ReplyTemplateComposerSheet
        sheetRef={composerRef}
        template={selectedTemplate}
        onDismiss={() => setSelectedTemplate(null)}
      />
    </View>
  );
}
