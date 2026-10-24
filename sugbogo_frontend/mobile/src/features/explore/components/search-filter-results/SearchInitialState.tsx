import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

const START_SEARCHING_MASCOT = require("@/shared/assets/mascot/mascot-start-searching.webp");

/** Offers a compact invitation to search before the first query is entered. */
export default function SearchInitialState() {
  return (
    <View className="items-center px-8 py-24">
      {/* Existing search mascot supports the invitation without dominating it. */}
      <Image
        source={START_SEARCHING_MASCOT}
        contentFit="contain"
        accessible={false}
        style={{
          width: 104,
          height: 104,
        }}
      />

      {/* Search guidance */}
      <AppText
        weight="bold"
        className="mt-4 text-center text-lg text-text-primary"
      >
        Find your next Cebu favorite
      </AppText>
      <AppText className="mt-2 max-w-72 text-center text-sm leading-5 text-text-secondary">
        Search for a business, category, or specialty to start exploring.
      </AppText>
    </View>
  );
}
