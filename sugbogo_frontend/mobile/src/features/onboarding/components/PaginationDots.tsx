import { View } from "react-native";

interface PaginationDotsProps {
  total: number;
  currentIndex: number;
}

/**
 * PaginationDots displays the current onboarding progress using indicator dots.
 * @param {number} total - The total number of onboarding screens.
 * @param {number} currentIndex - The index of the currently active onboarding screen.
 */
export default function PaginationDots({
  total,
  currentIndex,
}: PaginationDotsProps) {
  return (
    <View className="flex-row items-center justify-center">
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          className={`mx-1 h-2 w-2 rounded-full ${
            index === currentIndex ? "bg-[#F27F0D]" : "bg-gray-300"
          }`}
        />
      ))}
    </View>
  );
}
