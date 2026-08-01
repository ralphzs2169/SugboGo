import { Text, View } from "react-native";
import PromoteYourBusinessIllustration from "../../assets/illustrations/promote-business.svg";
import ReachMoreExplorersIllustration from "../../assets/illustrations/reach-more.svg";
import BuildYourReputationIllustration from "../../assets/illustrations/build-reputation.svg";
import TrackYourGrowthIllustration from "../../assets/illustrations/track-growth.svg";

const BENEFITS = [
  {
    title: "Promote your business",
    description: "Showcase your shop and help explorers discover your place.",
    illustration: PromoteYourBusinessIllustration,
  },
  {
    title: "Reach more explorers",
    description: "Increase your visibility and connect with more visitors.",
    illustration: ReachMoreExplorersIllustration,
  },
  {
    title: "Build your reputation",
    description: "Collect reviews and build trust with the community.",
    illustration: BuildYourReputationIllustration,
  },
  {
    title: "Track your growth",
    description: "Understand your performance through merchant insights.",
    illustration: TrackYourGrowthIllustration,
  },
] as const;

/**
 * Displays the benefits users receive as SugboGo merchants.
 *
 * Highlights how merchants can promote their business,
 * reach explorers, build trust, and monitor growth.
 */
export default function MerchantBenefits() {
  return (
    <View className="p-6 bg-surface">
      <Text className="mb-2 text-3xl font-bold  text-text-primary">
        What you'll get as a merchant
      </Text>
      <Text className="mb-8 text-md text-text-secondary">
        Discover how SugboGo helps your business reach more explorers and grow
        online.
      </Text>

      {/* <View className="border border-border-primary px-4 py-2 rounded-xl"> */}
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
              <Text className="w-6 pt-0.5 text-xl font-bold leading-6 text-text-primary">
                {index + 1}
              </Text>

              {/* Text */}
              <View className="flex-1 pt-0.5">
                <Text className="text-base font-bold text-text-primary">
                  {benefit.title}
                </Text>

                <Text className="mt-1 text-sm leading-5 text-text-secondary">
                  {benefit.description}
                </Text>
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
      {/* </View> */}
    </View>
  );
}
