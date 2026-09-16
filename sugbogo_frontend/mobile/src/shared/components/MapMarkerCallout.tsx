import { View } from "react-native";
import { Callout } from "react-native-maps";

import AppText from "@/shared/components/AppText";

type Props = {
  label?: string;
  title: string;
  description?: string | null;
  labelColor?: string;
};

/**
 * Displays consistently styled marker information inside the native map callout.
 *
 * Uses SugboGo typography while preserving the platform callout container for
 * more reliable rendering across Android and iOS.
 */
export default function MapMarkerCallout({
  label,
  title,
  description,
  labelColor,
}: Props) {
  return (
    <Callout>
      {/* Callout content */}
      <View
        style={{
          height: "auto",
          width: "auto",
          paddingVertical: 6,
          paddingHorizontal: 4,
          borderRadius: 8,
        }}
      >
        {label && (
          <AppText
            weight="bold"
            className="text-xs uppercase"
            style={labelColor ? { color: labelColor } : undefined}
          >
            {label}
          </AppText>
        )}

        <AppText
          weight="semibold"
          className={`${label ? "mt-1 " : ""}text-sm text-text-primary`}
        >
          {title}
        </AppText>

        {description && (
          <AppText className="mt-1 text-xs leading-4 text-text-secondary">
            {description}
          </AppText>
        )}
      </View>
    </Callout>
  );
}
