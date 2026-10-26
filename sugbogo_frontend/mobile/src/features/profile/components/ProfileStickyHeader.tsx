import { Animated, View } from "react-native";
import AppText from "@/shared/components/AppText";

type Props = {
  firstname: string;
  lastname: string;
  opacity: Animated.Value;
  translateY: Animated.Value;
};

/**
 * ProfileStickyHeader component displays a sticky header with the user's name that appears when scrolling down the profile screen.
 */
export default function ProfileStickyHeader({
  firstname,
  lastname,
  opacity,
  translateY,
}: Props) {
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 40,

        opacity,
        transform: [
          {
            translateY,
          },
        ],

        backgroundColor: "#ffffff",

        zIndex: 999,
        elevation: 1,

        // Bottom shadow only
        // shadowColor: "#000",
        // shadowOffset: {
        //   width: 0,
        //   height: 2,
        // },
        // shadowOpacity: 0.08,
        // shadowRadius: 3,
      }}
    >
      <View className="flex-1 items-center justify-center">
        <AppText weight="bold" className="text-base text-text-primary">
          {firstname} {lastname}
        </AppText>
      </View>
    </Animated.View>
  );
}
