import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import { SUPPORT_FAQ_CONTENT } from "../constants/supportFaqDraft";
import SupportFaqAnswer from "./SupportFaqAnswer";

/** Shows frequently asked questions and expands one answer at a time. */
export default function SupportFaqList() {
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  return (
    <View className="overflow-hidden rounded-xl border border-border-primary bg-surface">
      {SUPPORT_FAQ_CONTENT.map((faq, index) => {
        const expanded = openFaqId === faq.id;
        return (
          <View
            key={faq.id}
            className={index > 0 ? "border-t border-border-primary" : ""}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={faq.question}
              accessibilityState={{ expanded }}
              onPress={() => setOpenFaqId(expanded ? null : faq.id)}
              className="min-h-14 cursor-pointer flex-row items-center gap-3 px-4 py-4 active:opacity-70"
            >
              <AppText
                weight="semibold"
                className="min-w-0 flex-1 text-base text-text-primary"
              >
                {faq.question}
              </AppText>
              <MaterialCommunityIcons
                name={expanded ? "chevron-up" : "chevron-down"}
                size={24}
                color={theme.extends.colors.text.secondary}
                accessible={false}
                importantForAccessibility="no"
              />
            </Pressable>
            {expanded && <SupportFaqAnswer faq={faq} />}
          </View>
        );
      })}
    </View>
  );
}
