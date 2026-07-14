import { ReactNode } from "react";
import { View } from "react-native";

interface AuthCardProps {
  children: ReactNode;
}

/**
 * AuthCard component provides a styled card layout for authentication forms.
 * @param {ReactNode} children - The content to be displayed inside the card.
 */
export default function AuthCard({ children }: AuthCardProps) {
  return (
    <View
      className="w-full rounded-card bg-surface px-8 py-12"
      style={{
        shadowColor: "#000",
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {children}
    </View>
  );
}
