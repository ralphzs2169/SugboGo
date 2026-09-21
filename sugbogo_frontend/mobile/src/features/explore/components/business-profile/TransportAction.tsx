import { Image, type ImageSource } from "expo-image";
import { type ComponentType } from "react";

import AppText from "@/shared/components/AppText";
import SafePressable from "@/shared/components/SafePressable";

type TransportActionProps = {
  imageSource?: ImageSource;
  SvgIcon?: ComponentType<{
    width?: number;
    height?: number;
  }>;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
};

/**
 * Renders a compact transportation action using either a raster illustration
 * or an SVG icon depending on the supplied asset.
 */
export default function TransportAction({
  imageSource,
  SvgIcon,
  label,
  onPress,
  accessibilityLabel,
}: TransportActionProps) {
  return (
    <SafePressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="min-h-25 flex-1 cursor-pointer items-center justify-center rounded-xl bg-background-secondary px-2 py-2.5 active:opacity-70"
    >
      {/* Transportation illustration */}
      {SvgIcon ? (
        <SvgIcon width={46} height={46} />
      ) : imageSource ? (
        <Image
          source={imageSource}
          style={{
            width: 46,
            height: 46,
          }}
          contentFit="contain"
        />
      ) : null}

      {/* Transportation label */}
      <AppText
        weight="semibold"
        className="mt-1 text-center text-xs text-text-primary"
        numberOfLines={1}
      >
        {label}
      </AppText>
    </SafePressable>
  );
}
