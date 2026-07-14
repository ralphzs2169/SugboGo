/**
 * InterestGrid component renders a wrapping grid of selectable interest tags.
 * Used in the Onboarding Interest Initialization screen to capture user preferences
 * and solve the "Cold Start" problem for the Dynamic Discovery Engine.
 *
 * It maps over the predefined INTERESTS list and renders an InterestTag
 * for each item, passing the selection state and toggle handler down as props.
 */

import { View } from "react-native";
import InterestTag from "./InterestTag";

/**
 * Predefined list of SugboGo specialty interest tags.
 * These correspond to MSME specialty categories in the manuscript.
 */
const INTERESTS = [
  { id: "1", label: "Authentic" },
  { id: "2", label: "Heritage" },
  { id: "3", label: "BBQ" },
  { id: "4", label: "Handcrafted" },
  { id: "5", label: "Specialty Brew" },
  { id: "6", label: "Artisanal" },
  { id: "7", label: "Traditional" },
  { id: "8", label: "Eco-Friendly" },
  { id: "9", label: "Local Favorite" },
  { id: "10", label: "Private Cove" },
  { id: "11", label: "Spicy" },
  { id: "12", label: "Seafood" },
  { id: "13", label: "Woodwork" },
  { id: "14", label: "Weaving" },
];

interface InterestGridProps {
  /** Array of selected interest IDs */
  selected: string[];
  /** Callback to toggle selection of an interest by ID */
  onToggle: (id: string) => void;
}

export default function InterestGrid({
  selected,
  onToggle,
}: InterestGridProps) {
  return (
    // flex-wrap allows tags to wrap to the next line naturally
    <View className="flex-row flex-wrap">
      {INTERESTS.map((interest) => (
        <InterestTag
          key={interest.id}
          label={interest.label}
          isSelected={selected.includes(interest.id)}
          onPress={() => onToggle(interest.id)}
        />
      ))}
    </View>
  );
}
