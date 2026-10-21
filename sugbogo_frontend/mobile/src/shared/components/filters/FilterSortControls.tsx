import { LinearGradient } from "expo-linear-gradient";
import { type ReactNode, useState } from "react";
import { ScrollView, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type Props = {
  children: ReactNode;
  activeFilterCount: number;
  onClear: () => void;
  testID?: string;
  backgroundColor?: string;
};

/** Shared review-control layout; each feature owns its filters and ordering rules. */
export default function FilterSortControls({
  children,
  activeFilterCount,
  onClear,
  testID,
  backgroundColor = theme.extends.colors.background,
}: Props) {
  const [optionsWidth, setOptionsWidth] = useState(0);
  const [optionsContentWidth, setOptionsContentWidth] = useState(0);
  const [optionsScrollX, setOptionsScrollX] = useState(0);
  const optionsCanScroll = optionsContentWidth > optionsWidth + 1;
  const showLeftFade = optionsCanScroll && optionsScrollX > 4;
  const showRightFade =
    optionsCanScroll && optionsScrollX < optionsContentWidth - optionsWidth - 4;

  return (
    <View>
      {/* Shared heading and filter-only reset */}
      <View className="mb-3 min-h-11 flex-row items-center justify-between">
        <AppText weight="bold" className="text-sm text-text-primary">
          Filter & sort
        </AppText>
        {activeFilterCount > 0 && (
          <SafePressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel="Clear review filters"
            hitSlop={8}
            className="min-h-11 cursor-pointer justify-center py-1 active:opacity-70"
          >
            <AppText weight="semibold" className="text-xs text-brand">
              Clear filters
            </AppText>
          </SafePressable>
        )}
      </View>
      {/* Quick filtering and sorting controls */}
      <View
        className="relative"
        onLayout={(event) => {
          setOptionsWidth(event.nativeEvent.layout.width);
        }}
      >
        <ScrollView
          testID={testID}
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onContentSizeChange={(width) => {
            setOptionsContentWidth(width);
          }}
          onScroll={(event) => {
            setOptionsScrollX(event.nativeEvent.contentOffset.x);
          }}
          contentContainerClassName="items-center gap-2 px-1 pr-3"
        >
          {children}
        </ScrollView>

        {/* Horizontal overflow indicators */}
        {showLeftFade && (
          <LinearGradient
            pointerEvents="none"
            colors={[backgroundColor, `${backgroundColor}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: 32,
              zIndex: 10,
            }}
          />
        )}

        {showRightFade && (
          <LinearGradient
            pointerEvents="none"
            colors={[`${backgroundColor}00`, backgroundColor]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: 0,
              width: 32,
              zIndex: 10,
            }}
          />
        )}
      </View>
    </View>
  );
}
