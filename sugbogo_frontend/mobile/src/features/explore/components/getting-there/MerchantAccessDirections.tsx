import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  directions?: string | null;
  collapsible?: boolean;
  className?: string;
  presentation?: "inline" | "card" | "sheet";
};

/** Shows quiet merchant access context, with line-based expansion only for long notes. */
export default function MerchantAccessDirections({
  directions,
  collapsible = true,
  className = "mt-4",
  presentation = "card",
}: Props) {
  const text = directions?.trim();
  const inline = presentation === "inline";
  const previewLines = inline ? 3 : 4;
  const [preview, setPreview] = useState({
    text,
    isTruncated: false,
    isExpanded: false,
  });
  const isTruncated =
    collapsible && preview.text === text && preview.isTruncated;
  const isExpanded = preview.text === text && preview.isExpanded;

  if (!text) {
    return null;
  }

  return (
    <View className={className}>
      {presentation === "card" && (
        <AppText
          accessibilityRole="header"
          weight="semibold"
          className="mb-2 text-sm text-text-primary"
        >
          Access notes
        </AppText>
      )}
      <View
        className={
          inline
            ? "flex-row items-start"
            : presentation === "card"
              ? "overflow-hidden rounded-xl bg-surface-muted p-4"
              : undefined
        }
      >
        {inline && (
          <MaterialCommunityIcons
            name="format-quote-open"
            size={19}
            color={theme.extends.colors.text.secondary}
            accessible={false}
          />
        )}
        <View className={inline ? "ml-3 min-w-0 flex-1" : undefined}>
          {/* Merchant attribution stays distinct from computed guidance. */}
          {inline ? (
            <View className="flex-row flex-wrap items-center gap-x-1.5 gap-y-1">
              <AppText
                accessibilityRole="header"
                weight="semibold"
                className="text-xs leading-4 text-text-secondary"
              >
                Access notes
              </AppText>
              <AppText
                accessible={false}
                className="text-xs text-text-tertiary"
              >
                ·
              </AppText>
              <AppText className="text-xs leading-4 text-text-secondary">
                Merchant-provided
              </AppText>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons
                name="format-quote-open"
                size={20}
                color={theme.extends.colors.text.tertiary}
                accessible={false}
              />
              <AppText className="min-w-0 flex-1 text-xs leading-4 text-text-secondary">
                Merchant-provided
              </AppText>
            </View>
          )}
          <AppText
            selectable
            className={
              inline
                ? "mt-1 text-sm leading-5 text-text-secondary"
                : "mt-3 text-sm leading-6 text-text-primary"
            }
            numberOfLines={
              isTruncated && !isExpanded ? previewLines : undefined
            }
            onTextLayout={(event) => {
              // Match the review text's full-layout-first expansion pattern.
              if (collapsible && !isExpanded && !isTruncated) {
                const exceedsPreview =
                  event.nativeEvent.lines.length > previewLines;
                if (exceedsPreview) {
                  setPreview({ text, isTruncated: true, isExpanded: false });
                }
              }
            }}
          >
            {text}
          </AppText>
          {isTruncated && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                isExpanded
                  ? "Show less of access notes"
                  : "Read more access notes"
              }
              accessibilityState={{ expanded: isExpanded }}
              onPress={() =>
                setPreview((current) => ({
                  ...current,
                  isExpanded: !current.isExpanded,
                }))
              }
              className="min-h-12 cursor-pointer justify-center self-start active:opacity-70"
            >
              <AppText weight="semibold" className="text-sm text-brand">
                {isExpanded ? "Show less" : "Read more"}
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
