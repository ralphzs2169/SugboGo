import { View } from "react-native";

type Props = {
  className?: string;
};

/**
 * Displays a static placeholder block used while content is loading.
 * Intentionally unanimated — see note in SkeletonPulseProvider removal
 * for why (perf cost during screen transitions outweighed the polish).
 */
export default function Skeleton({ className = "" }: Props) {
  return <View className={`bg-border-primary ${className}`} />;
}
