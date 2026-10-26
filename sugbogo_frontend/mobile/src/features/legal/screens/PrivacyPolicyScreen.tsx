import { MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentProps, useRef, useState } from "react";
import { Pressable, ScrollView, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/constants/theme";
import AppText from "@/shared/components/AppText";

import {
  PRIVACY_POLICY_DRAFT,
  type PrivacyPolicyDraftBlock,
} from "../constants/privacyPolicyDraft";

const SECTION_ICONS: Readonly<
  Record<string, ComponentProps<typeof MaterialCommunityIcons>["name"]>
> = {
  introduction: "information-outline",
  "information-we-collect": "account-details-outline",
  "how-we-use-information": "clipboard-list-outline",
  "third-party-services": "share-variant-outline",
  "reviews-moderation-and-ai-assisted-features": "comment-check-outline",
  "information-storage-and-security": "shield-lock-outline",
  "data-retention": "clock-outline",
  "account-deactivation-and-data-deletion": "account-off-outline",
  "user-choices-and-controls": "tune-variant",
  "accessing-or-correcting-personal-information": "account-edit-outline",
  "changes-to-this-privacy-policy": "file-document-edit-outline",
  "contact-information": "email-outline",
};

/** Renders a supplied draft paragraph, subheading, or wrapping list. */
function DraftBlock({ block }: { block: PrivacyPolicyDraftBlock }) {
  if (block.type === "list") {
    return (
      <View className="gap-2">
        {/* Ordered or bulleted policy items */}
        {block.items.map((item, index) => (
          <View key={index} className="flex-row items-start gap-2">
            <AppText
              accessible={false}
              importantForAccessibility="no"
              className="min-w-6 shrink-0 text-base leading-6 text-text-primary"
            >
              {block.ordered ? `${index + 1}.` : "•"}
            </AppText>
            <AppText
              accessibilityLabel={
                block.ordered ? `${index + 1}. ${item}` : undefined
              }
              className="flex-1 text-base leading-6 text-text-primary"
            >
              {item}
            </AppText>
          </View>
        ))}
      </View>
    );
  }

  const isSubheading = block.type === "subheading";

  return (
    <AppText
      accessibilityRole={isSubheading ? "header" : undefined}
      weight={isSubheading ? "semibold" : "regular"}
      className={
        isSubheading
          ? "mt-2 text-base text-text-primary"
          : "text-base leading-6 text-text-primary"
      }
    >
      {block.text}
    </AppText>
  );
}

/** Navigates the continuous, unapproved development draft; production retains its placeholder. */
export default function PrivacyPolicyScreen() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(PRIVACY_POLICY_DRAFT[0].id);
  const documentRef = useRef<ScrollView>(null);
  const sectionPositions = useRef(new Map<string, number>());
  const pendingSection = useRef<string | null>(null);
  const { height } = useWindowDimensions();
  const selectedSection = PRIVACY_POLICY_DRAFT.find(
    (section) => section.id === selectedId,
  )!;

  function scrollToSection(id: string) {
    const y = sectionPositions.current.get(id);
    if (y === undefined || !documentRef.current) {
      pendingSection.current = id;
      return;
    }
    pendingSection.current = null;
    documentRef.current.scrollTo({ y, animated: true });
  }

  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="flex-1 bg-background"
    >
      {/* Section navigation stays above the continuous development document. */}
      {__DEV__ && (
        <View className="border-b border-border-primary bg-surface">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a Privacy Policy section"
            accessibilityValue={{ text: selectedSection.heading }}
            accessibilityState={{ expanded: menuOpen }}
            onPress={() => setMenuOpen((open) => !open)}
            className="min-h-12 flex-row items-center gap-3 px-6 py-3 cursor-pointer active:opacity-70"
          >
            <AppText weight="semibold" className="flex-1 text-base text-brand">
              {selectedSection.heading}
            </AppText>
            <MaterialCommunityIcons
              name={menuOpen ? "chevron-up" : "chevron-down"}
              size={24}
              color={theme.extends.colors.text.secondary}
              accessible={false}
              importantForAccessibility="no"
            />
          </Pressable>
          {menuOpen && (
            <ScrollView
              testID="privacy-policy-sections"
              style={{ maxHeight: height * 0.35 }}
              className="border-t border-border-primary"
            >
              {PRIVACY_POLICY_DRAFT.map((section) => (
                <Pressable
                  key={section.id}
                  accessibilityRole="button"
                  accessibilityLabel={section.heading}
                  accessibilityState={{ selected: section.id === selectedId }}
                  onPress={() => {
                    setSelectedId(section.id);
                    setMenuOpen(false);
                    scrollToSection(section.id);
                  }}
                  className="min-h-12 justify-center px-6 py-3 cursor-pointer active:opacity-70"
                >
                  <AppText
                    weight={section.id === selectedId ? "semibold" : "regular"}
                    className={`text-base ${section.id === selectedId ? "text-brand" : "text-text-primary"}`}
                  >
                    {section.heading}
                  </AppText>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Policy document or production placeholder */}
      <ScrollView
        ref={documentRef}
        testID="privacy-policy-scroll"
        className="flex-1"
        contentContainerClassName={__DEV__ ? "px-6 py-6 gap-6" : "px-6 py-6"}
        onContentSizeChange={() => {
          if (pendingSection.current) scrollToSection(pendingSection.current);
        }}
        showsVerticalScrollIndicator={false}
      >
        {__DEV__ ? (
          <>
            {PRIVACY_POLICY_DRAFT.map((section) => (
              <View
                key={section.id}
                testID={`privacy-policy-section-${section.id}`}
                className="gap-3"
                onLayout={({ nativeEvent: { layout } }) => {
                  // Direct children measure in the ScrollView's content coordinates,
                  // including its padding, without header or dropdown offsets.
                  sectionPositions.current.set(section.id, layout.y);
                  if (pendingSection.current === section.id) {
                    scrollToSection(section.id);
                  }
                }}
              >
                <View className="flex-row items-start gap-3">
                  <View className="h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
                    <MaterialCommunityIcons
                      name={SECTION_ICONS[section.id]}
                      size={19}
                      color={theme.extends.colors.brand}
                      accessible={false}
                      importantForAccessibility="no"
                    />
                  </View>
                  <AppText
                    accessibilityRole="header"
                    weight="bold"
                    className="min-w-0 flex-1 text-lg leading-7 text-text-primary"
                  >
                    {section.heading}
                  </AppText>
                </View>
                <View className="gap-3">
                  {section.blocks.map((block, index) => (
                    <DraftBlock key={index} block={block} />
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : (
          <>
            <AppText weight="semibold" className="text-sm text-text-secondary">
              Development placeholder
            </AppText>
            <AppText className="mt-2 text-base leading-6 text-text-primary">
              Privacy Policy content is under review and is not yet available.
            </AppText>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
