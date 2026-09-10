import { MaterialCommunityIcons } from "@expo/vector-icons";
import { View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type ExplorePrompt = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

type Props = {
  onPromptPress?: (promptId: string) => void;
};

const EXPLORE_PROMPTS: ExplorePrompt[] = [
  {
    id: "culinary",
    title: "Find something to eat",
    subtitle: "Discover local food, cafés, and treats",
    icon: "silverware-fork-knife",
  },
  {
    id: "creative",
    title: "Discover local crafts",
    subtitle: "Browse handmade goods and creative finds",
    icon: "palette-outline",
  },
  {
    id: "leisure",
    title: "Find somewhere to unwind",
    subtitle: "Explore relaxing and leisure experiences",
    icon: "leaf",
  },
];

/**
 * Displays simple discovery prompts for explorers who do not have a specific
 * place or specialty in mind.
 *
 * Each prompt acts as a high-level shortcut that can later open filtered
 * Explore results for the corresponding discovery intent.
 */
export default function ExplorePromptSection({ onPromptPress }: Props) {
  return (
    <View className="py-6">
      {/* Section introduction */}
      <View className="mb-4 px-4">
        <AppText weight="bold" className="text-xl text-text-primary">
          Not sure what to explore?
        </AppText>

        <AppText className="mt-1 text-sm leading-5 text-text-secondary">
          Start with what you feel like doing.
        </AppText>
      </View>

      {/* Discovery prompts */}
      <View className="gap-3 px-4">
        {EXPLORE_PROMPTS.map((prompt) => (
          <SafePressable
            key={prompt.id}
            onPress={() => onPromptPress?.(prompt.id)}
            accessibilityRole="button"
            accessibilityLabel={prompt.title}
            className="cursor-pointer flex-row items-center rounded-card border border-border-primary bg-surface px-4 py-3.5 active:opacity-80"
            android_ripple={{
              color: "rgba(0,0,0,0.04)",
            }}
          >
            {/* Prompt icon */}
            <View className="h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/10">
              <MaterialCommunityIcons
                name={prompt.icon}
                size={22}
                color={theme.extends.colors.brand}
              />
            </View>

            {/* Prompt details */}
            <View className="min-w-0 flex-1 pl-3">
              <AppText
                weight="semibold"
                className="text-[15px] text-text-primary"
                numberOfLines={1}
              >
                {prompt.title}
              </AppText>

              <AppText
                className="mt-0.5 text-xs leading-5 text-text-secondary"
                numberOfLines={1}
              >
                {prompt.subtitle}
              </AppText>
            </View>

            {/* Navigation affordance */}
            <MaterialCommunityIcons
              name="chevron-right"
              size={21}
              color={theme.extends.colors.text.tertiary}
            />
          </SafePressable>
        ))}
      </View>
    </View>
  );
}
