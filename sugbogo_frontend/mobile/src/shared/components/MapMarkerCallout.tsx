import { useState } from "react";
import { View } from "react-native";
import { Callout } from "react-native-maps";
import Svg, { Path } from "react-native-svg";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

type Props = {
  label?: string;
  title: string;
  description?: string | null;
  labelColor?: string;
};

const CALLOUT_WIDTH = 210;
const CALLOUT_RADIUS = 14;

const CALLOUT_HORIZONTAL_PADDING = 12;
const CALLOUT_VERTICAL_PADDING = 10;

const POINTER_WIDTH = 18;
const POINTER_HEIGHT = 10;

const CALLOUT_BACKGROUND = "#FFFFFF";
const CALLOUT_BORDER_COLOR = theme.extends.colors.border.secondary;

/**
 * Displays compact contextual information for a map marker.
 *
 * Uses a single SVG speech-bubble surface with an integrated pointer so the
 * callout appears as one continuous shape rather than separate joined pieces.
 */
export default function MapMarkerCallout({
  label,
  title,
  description,
  labelColor,
}: Props) {
  const accentColor = labelColor ?? theme.extends.colors.brand;
  const [contentHeight, setContentHeight] = useState(0);

  const bubbleHeight = contentHeight;
  const totalHeight = bubbleHeight + POINTER_HEIGHT;

  const centerX = CALLOUT_WIDTH / 2;
  const pointerHalfWidth = POINTER_WIDTH / 2;

  const bubblePath =
    contentHeight > 0
      ? `
        M ${CALLOUT_RADIUS} 1

        H ${CALLOUT_WIDTH - CALLOUT_RADIUS}

        Q ${CALLOUT_WIDTH - 1} 1
          ${CALLOUT_WIDTH - 1} ${CALLOUT_RADIUS}

        V ${bubbleHeight - CALLOUT_RADIUS}

        Q ${CALLOUT_WIDTH - 1} ${bubbleHeight - 1}
          ${CALLOUT_WIDTH - CALLOUT_RADIUS} ${bubbleHeight - 1}

        H ${centerX + pointerHalfWidth}

        L ${centerX} ${totalHeight - 1}

        L ${centerX - pointerHalfWidth} ${bubbleHeight - 1}

        H ${CALLOUT_RADIUS}

        Q 1 ${bubbleHeight - 1}
          1 ${bubbleHeight - CALLOUT_RADIUS}

        V ${CALLOUT_RADIUS}

        Q 1 1
          ${CALLOUT_RADIUS} 1

        Z
      `
      : "";

  return (
    <Callout tooltip>
      <View
        style={{
          width: CALLOUT_WIDTH,
          paddingBottom: POINTER_HEIGHT,
        }}
      >
        {/* Unified speech-bubble surface */}
        {contentHeight > 0 && (
          <Svg
            pointerEvents="none"
            width={CALLOUT_WIDTH}
            height={totalHeight}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
            }}
          >
            {/* Soft bubble shadow */}
            <Path
              d={bubblePath}
              fill="rgba(0, 0, 0, 0.10)"
              transform="translate(0 2)"
            />

            {/* Bubble body and integrated pointer */}
            <Path
              d={bubblePath}
              fill={CALLOUT_BACKGROUND}
              stroke={CALLOUT_BORDER_COLOR}
              strokeWidth={1}
              strokeLinejoin="round"
            />
          </Svg>
        )}

        {/* Callout information */}
        <View
          onLayout={(event) => {
            setContentHeight(event.nativeEvent.layout.height);
          }}
          style={{
            paddingHorizontal: CALLOUT_HORIZONTAL_PADDING,
            paddingVertical: CALLOUT_VERTICAL_PADDING,
          }}
        >
          {/* Marker context */}
          {label && (
            <View className="mb-1.5 flex-row items-center">
              <View
                className="mr-1.5 h-2 w-2 rounded-full"
                style={{
                  backgroundColor: accentColor,
                }}
              />

              <AppText
                weight="bold"
                className="text-[10px] uppercase tracking-wide"
                style={{
                  color: accentColor,
                }}
              >
                {label}
              </AppText>
            </View>
          )}

          {/* Marker title */}
          <AppText
            weight="bold"
            className="text-sm leading-5 text-text-primary"
            numberOfLines={2}
          >
            {title}
          </AppText>

          {/* Supporting context */}
          {description && (
            <AppText
              className="mt-1 text-[11px] leading-4 text-text-secondary"
              numberOfLines={2}
            >
              {description}
            </AppText>
          )}
        </View>
      </View>
    </Callout>
  );
}
