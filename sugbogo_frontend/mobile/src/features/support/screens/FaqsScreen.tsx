import { ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import SupportFaqList from "../components/SupportFaqList";

/** Shows SugboGo's frequently asked questions with expandable answers. */
export default function FaqsScreen() {
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-6 py-6"
        showsVerticalScrollIndicator={false}
      >
        <SupportFaqList />
      </ScrollView>
    </SafeAreaView>
  );
}
