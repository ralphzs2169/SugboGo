import { View } from "react-native";
import PromoteYourBusinessIllustration from "../../assets/illustrations/promote-business.svg";
import ReachMoreExplorersIllustration from "../../assets/illustrations/reach-more.svg";
import BuildYourReputationIllustration from "../../assets/illustrations/build-reputation.svg";
import TrackYourGrowthIllustration from "../../assets/illustrations/track-growth.svg";
import AppText from "@/shared/components/AppText";

const BENEFITS = [
  {
    title: "Get discovered on SugboGo",
    description:
      "Explorers can find your business in Explore and open your listing.",
    illustration: ReachMoreExplorersIllustration,
  },
  {
    title: "Keep your listing up to date",
    description: "Update your business details, hours, and photos.",
    illustration: PromoteYourBusinessIllustration,
  },
  {
    title: "Respond to customer reviews",
    description: "Read and reply to reviews on your listing.",
    illustration: BuildYourReputationIllustration,
  },
  {
    title: "See how people engage with your listing",
    description: "Track profile visits, saves, and new reviews.",
    illustration: TrackYourGrowthIllustration,
  },
] as const;

/**
 * Shows what merchants can do after their application is approved.
 */
export default function MerchantBenefits() {
  return (
    <View className="p-6 bg-surface">
      <AppText weight="extrabold" className="mb-2 text-3xl   text-text-primary">
        What you’ll get as a merchant
      </AppText>
      <AppText weight="medium" className="mb-8  text-text-secondary">
        Merchant Mode becomes available once your application is approved.
      </AppText>

      <View>
        {BENEFITS.map((benefit, index) => {
          const Illustration = benefit.illustration;

          return (
            <View
              key={benefit.title}
              className={
                "flex-row items-start gap-2 py-3" +
                (index !== BENEFITS.length - 1
                  ? " border-b border-border-primary/60"
                  : "")
              }
            >
              {/* Number */}
              <AppText
                weight="bold"
                className="w-6 pt-0.5 text-xl  leading-6 text-text-primary"
              >
                {index + 1}
              </AppText>

              {/* Text */}
              <View className="flex-1 pt-0.5">
                <AppText weight="bold" className="text-base  text-text-primary">
                  {benefit.title}
                </AppText>

                <AppText className="mt-1 text-sm leading-5 text-text-secondary">
                  {benefit.description}
                </AppText>
              </View>

              {/* Illustration */}
              {Illustration && (
                <View className="ml-2">
                  <Illustration width={72} height={72} />
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}
