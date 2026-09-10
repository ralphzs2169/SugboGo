import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import ErrorState from "@/shared/components/ErrorState";
import type { ApiResponse } from "@/shared/types/apiResponse.types";
import { handleSystemError } from "@/shared/utils/apiErrors";

import ReplyTemplateCard from "../../components/review-management/reply-template/ReplyTemplateCard";
import ReplyTemplateComposerSheet from "../../components/review-management/reply-template/ReplyTemplateComposerSheet";
import ReplyTemplatesScreenSkeleton from "../../components/review-management/reply-template/ReplyTemplateScreenSkeleton";
import { useReplyTemplates } from "../../hooks/reply-templates/useReplyTemplates";
import type { ReplyTemplate } from "../../types/reply-templates/replyTemplate.types";

const MASCOT_NO_HISTORY = require("@/shared/assets/mascot/mascot-no-history.webp");

/**
 * Provides merchants with a dedicated space to manage reusable responses.
 *
 * Supports template creation and editing, pull-to-refresh, consistent loading
 * and empty states, and a persistent add action near the bottom of the screen.
 */
export default function ReplyTemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const composerRef = useRef<BottomSheetModal | null>(null);

  const [selectedTemplate, setSelectedTemplate] =
    useState<ReplyTemplate | null>(null);

  const { templates, isLoading, isRefetching, error, refetch } =
    useReplyTemplates();

  useEffect(() => {
    if (!error) {
      return;
    }

    const response = error as unknown as ApiResponse<unknown>;

    if (!response.success && !handleSystemError(response)) {
      Toast.show({
        type: "error",
        text1: "Unable to load templates",
        text2: response.message || "Please try again.",
      });
    }
  }, [error]);

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  const openCreateComposer = () => {
    setSelectedTemplate(null);
    composerRef.current?.present();
  };

  const openEditComposer = (template: ReplyTemplate) => {
    setSelectedTemplate(template);
    composerRef.current?.present();
  };

  if (isLoading) {
    return <ReplyTemplatesScreenSkeleton />;
  }

  if (error && templates.length === 0) {
    return (
      <View className="flex-1 bg-surface">
        {/* Template collection error */}
        <ErrorState
          size="small"
          icon="text-box-remove-outline"
          title="Unable to load templates"
          description="We couldn't load your reply templates right now."
          primaryActionTitle="Retry"
          secondaryActionTitle="Go back"
          onPrimaryAction={refresh}
          onSecondaryAction={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-surface">
      {/* Template collection */}
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
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refresh}
            tintColor={theme.extends.colors.brand}
          />
        }
        ListHeaderComponent={
          <View className="mb-5">
            {/* Screen guidance */}
            <AppText className="text-sm leading-5 text-text-secondary">
              Save reusable responses so you can reply to customer reviews
              faster and keep your messaging consistent.
            </AppText>
          </View>
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        ListEmptyComponent={
          <View className="items-center px-6 py-12">
            {/* Empty template state */}
            <Image
              source={MASCOT_NO_HISTORY}
              style={{
                width: 120,
                height: 120,
              }}
              contentFit="contain"
            />

            <AppText
              weight="bold"
              className="mt-2 text-center text-base text-text-primary"
            >
              No reply templates yet
            </AppText>

            <AppText className="mt-1 max-w-72 text-center text-sm leading-5 text-text-secondary">
              Create reusable responses to make replying to customer reviews
              faster.
            </AppText>
          </View>
        }
      />

      {/* Add template action */}
      <View
        className="absolute left-0 right-0 items-center px-4"
        style={{
          bottom: insets.bottom + 12,
        }}
      >
        <Pressable
          onPress={openCreateComposer}
          accessibilityRole="button"
          accessibilityLabel="Add reply template"
          className="min-h-12 cursor-pointer flex-row items-center rounded-full bg-brand px-5 active:opacity-80"
        >
          <MaterialCommunityIcons name="plus" size={20} color="white" />

          <AppText weight="bold" className="ml-2 text-sm text-white">
            Add template
          </AppText>
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
