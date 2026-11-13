import { useEffect, useRef } from "react";
import { AccessibilityInfo, Pressable, ScrollView, View } from "react-native";

import AppText from "@/shared/components/AppText";
import Button from "@/shared/components/Button";
import { shadows } from "@/shared/styles/shadows";

type Props = {
  title: string;
  description: string;
  step: number;
  total: number;
  left: number;
  width: number;
  bottom: number;
  maxHeight: number;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  onDismiss: () => void;
};

/** Places tour instructions and controls above a measured spotlight. */
export default function SpotlightTooltip({
  title,
  description,
  step,
  total,
  left,
  width,
  bottom,
  maxHeight,
  onBack,
  onNext,
  onSkip,
  onDismiss,
}: Props) {
  const announcement = useRef<View>(null);
  const progress = `Step ${step} of ${total}`;
  const isLastStep = step === total;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (announcement.current) {
        AccessibilityInfo.sendAccessibilityEvent(
          announcement.current,
          "focus",
        );
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [step]);

  return (
    <View
      className="absolute rounded-card border border-border-primary bg-surface"
      style={[shadows.floating, { left, width, bottom, maxHeight }]}
      accessibilityViewIsModal
      onAccessibilityEscape={onDismiss}
    >
      <ScrollView
        bounces={false}
        style={{ flexGrow: 0 }}
        contentContainerClassName="gap-3 p-4"
      >
        {/* Step instructions */}
        <View
          ref={announcement}
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${progress}. ${title} ${description}`}
          onAccessibilityEscape={onDismiss}
          className="gap-1.5"
        >
          <View className="flex-row items-center gap-2">
            <View className="h-1.5 w-1.5 rounded-full bg-brand" />
            <AppText weight="bold" className="text-xs text-text-secondary">
              {progress}
            </AppText>
          </View>
          <AppText weight="bold" className="text-lg text-text-primary">
            {title}
          </AppText>
          <AppText className="text-sm text-text-secondary">{description}</AppText>
        </View>

        {/* Tour controls */}
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <Pressable
            onPress={onSkip}
            accessibilityRole="button"
            className="min-h-[48px] cursor-pointer justify-center px-2 active:opacity-70"
          >
            <AppText weight="semibold" className="text-sm text-text-secondary">
              Skip
            </AppText>
          </Pressable>
          <View className="flex-row flex-wrap items-center gap-2">
            <Button
              title="Back"
              onPress={onBack}
              disabled={step === 1}
              size="sm"
              variant="outline"
              className="min-h-[48px]"
            />
            <Button
              title={isLastStep ? "Got it!" : "Next"}
              onPress={onNext}
              size="sm"
              textTone="primary"
              className="min-h-[48px]"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
