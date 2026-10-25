import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { AppState, Pressable, View } from "react-native";
import { useNavigation } from "expo-router";

import ParticleBurst, {
  type ParticleBurstHandle,
} from "@/shared/components/ParticleBurst";

import AppText from "@/shared/components/AppText";
import { getSpecialtyTagColor } from "@/shared/constants/specialtyTagColors";
import { getSpecialtyTagIcon } from "@/shared/constants/specialtyTagIcons";
import type {
  SpecialtyTagColor,
  SpecialtyTagIcon,
} from "@/shared/types/specialtyTag.types";

type Props = {
  name: string;
  color: SpecialtyTagColor;
  icon?: SpecialtyTagIcon | null;
  vouchCount: number | null;
  isVouched: boolean | null;
  onPress?: (onAccepted?: () => void) => Promise<unknown> | undefined;
  disabled?: boolean;
  celebrationEnabled?: boolean;
};

const REACTION_SIZE = 54;
const REACTION_WRAPPER_SIZE = 62;

/**
 * Displays a compact specialty vouch reaction.
 *
 * Keeps inactive and vouched states visually distinct while preserving a
 * lightweight social-reaction feel and animated feedback.
 */
export default function BusinessSpecialtyVouchCard({
  name,
  color,
  icon,
  vouchCount,
  isVouched,
  onPress,
  disabled = false,
  celebrationEnabled = true,
}: Props) {
  const styles = getSpecialtyTagColor(color);
  const iconName = getSpecialtyTagIcon(icon);

  const celebration = useRef<ParticleBurstHandle>(null);
  const navigation = useNavigation();
  const generation = useRef(0);
  const foregroundColor = isVouched ? "#FFFFFF" : styles.borderColor;

  useEffect(() => {
    const cancel = () => {
      generation.current += 1;
      celebration.current?.cancel();
    };
    const unsubscribe = navigation.addListener("blur", cancel);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") cancel();
    });
    return () => {
      unsubscribe();
      subscription.remove();
      cancel();
    };
  }, [navigation]);

  useEffect(() => {
    if (!celebrationEnabled) {
      generation.current += 1;
      celebration.current?.cancel();
    }
  }, [celebrationEnabled]);

  async function handlePress() {
    if (disabled || !onPress || !navigation.isFocused()) return;
    const requestGeneration = generation.current;
    let celebrated = false;
    const celebrate = () => {
      if (
        !celebrated &&
        celebrationEnabled &&
        generation.current === requestGeneration &&
        navigation.isFocused()
      ) {
        celebrated = true;
        celebration.current?.play();
      }
    };
    // Every accepted add is optimistic; responses never start another burst.
    await onPress(celebrate);
  }

  return (
    <Pressable
      onPressIn={() => {
        celebration.current?.setPressed(true);
      }}
      onPressOut={() => celebration.current?.setPressed(false)}
      onPress={() => void handlePress()}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={
        vouchCount === null
          ? `${name}, Vouch unavailable offline`
          : `${name}, ${vouchCount} ${vouchCount === 1 ? "vouch" : "vouches"}`
      }
      accessibilityState={{
        disabled,
        selected: isVouched ?? undefined,
      }}
      className="flex-1 cursor-pointer items-center px-0.5 py-1 active:opacity-75 disabled:opacity-50"
    >
      {/* Specialty reaction */}
      <View
        className="relative items-center justify-center"
        style={{
          width: REACTION_WRAPPER_SIZE,
          height: REACTION_WRAPPER_SIZE,
        }}
      >
        {isVouched && (
          <View
            pointerEvents="none"
            className="absolute rounded-full"
            style={{
              width: REACTION_SIZE + 8,
              height: REACTION_SIZE + 8,
              backgroundColor: styles.borderColor,
              opacity: 0.1,
            }}
          />
        )}

        <ParticleBurst ref={celebration} color={styles.borderColor}>
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: REACTION_SIZE,
              height: REACTION_SIZE,
              borderWidth: isVouched ? 0 : 1.5,
              borderColor: isVouched ? "transparent" : styles.borderColor,
              backgroundColor: isVouched ? styles.borderColor : "#FFFFFF",
            }}
          >
            <MaterialCommunityIcons
              name={iconName}
              size={24}
              color={foregroundColor}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
          </View>
        </ParticleBurst>
      </View>

      {/* Specialty label */}
      <View className="min-h-8 w-full items-center justify-center px-1">
        <AppText
          weight="semibold"
          className="w-full text-center text-[11px] leading-[14px] text-text-primary"
          numberOfLines={2}
        >
          {name}
        </AppText>
      </View>

      {/* Vouch state */}
      <View
        className="mt-0.5 flex-row items-center justify-center rounded-full px-2 py-0.5"
        style={{
          backgroundColor: isVouched
            ? styles.borderColor
            : `${styles.borderColor}14`,
        }}
      >
        <View>
          <MaterialCommunityIcons
            name={isVouched ? "heart" : "heart-outline"}
            size={14}
            color={isVouched ? "#FFFFFF" : styles.borderColor}
          />
        </View>

        <AppText
          weight="bold"
          className="ml-1 text-[10px]"
          style={{
            color: isVouched ? "#FFFFFF" : styles.borderColor,
          }}
        >
          {vouchCount ?? "Vouch"}
        </AppText>
      </View>
    </Pressable>
  );
}
