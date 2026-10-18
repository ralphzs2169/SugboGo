import { Image } from "expo-image";
import { View } from "react-native";

import AppText from "@/shared/components/AppText";

import type { NotificationFilter } from "../types/notification.types";

const MASCOT_ALL_CAUGHT_UP = require("@/shared/assets/mascot/mascot-all-caught-up.webp");

type Props = {
  filter: NotificationFilter;
};

/** Displays a positive account inbox empty state for the selected filter. */
export default function NotificationEmptyState({ filter }: Props) {
  const isUnread = filter === "unread";

  return (
    <View className="flex-1 items-center justify-center px-8 pb-10">
      {/* Empty-state mascot */}
      <Image
        source={MASCOT_ALL_CAUGHT_UP}
        style={{ width: 128, height: 128 }}
        contentFit="contain"
        accessible
        accessibilityLabel="SugboGo mascot giving a thumbs up"
      />

      {/* Empty-state message */}
      <AppText
        weight="bold"
        className="mt-3 text-center text-lg text-text-primary"
      >
        {isUnread ? "No unread notifications" : "You’re all caught up!"}
      </AppText>

      <AppText className="mt-1.5 max-w-72 text-center text-sm leading-5 text-text-secondary">
        {isUnread
          ? "You’re up to date with your notifications."
          : "Notifications about your activities and updates will appear here."}
      </AppText>
    </View>
  );
}
