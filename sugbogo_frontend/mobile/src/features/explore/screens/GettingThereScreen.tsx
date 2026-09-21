// import { router } from "expo-router";
// import { ScrollView, View } from "react-native";
// import { SafeAreaView } from "react-native-safe-area-context";

// import AppText from "@/shared/components/AppText";
// import ErrorState from "@/shared/components/ErrorState";
// import useQueryErrorNotification from "@/shared/hooks/useQueryErrorNotification";

// import GrabHandoffCard from "../components/getting-there/GrabHandoffCard";
// import JeepneyGuideEntryCard from "../components/getting-there/jeepney-guidance/JeepneyGuideEntryCard";
// import RoadRouteEntryCard from "../components/getting-there/RoadRouteEntryCard";
// import useExploreBusinessProfile from "../hooks/useExploreBusinessProfile";

// type Props = {
//   businessId: number;
// };

// /** Presents independent transportation choices for reaching one business. */
// export default function GettingThereScreen({ businessId }: Props) {
//   const businessQuery = useExploreBusinessProfile(businessId);

//   useQueryErrorNotification({
//     error: businessQuery.error,
//     toastId: "getting-there-business-error",
//     title: "Unable to load destination",
//     fallbackMessage: "We couldn't load this business right now.",
//   });

//   if (businessQuery.error && !businessQuery.business) {
//     return (
//       <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
//         <ErrorState
//           title="Unable to load destination"
//           description="We couldn't load this business right now."
//           primaryActionTitle="Retry"
//           secondaryActionTitle="Go back"
//           onPrimaryAction={() => void businessQuery.refetch()}
//           onSecondaryAction={() => router.back()}
//         />
//       </SafeAreaView>
//     );
//   }

//   const businessName = businessQuery.business?.business_name ?? "Destination";

//   return (
//     <SafeAreaView edges={["bottom"]} className="flex-1 bg-background">
//       <ScrollView
//         className="flex-1"
//         showsVerticalScrollIndicator={false}
//         contentContainerClassName="px-screen-x pb-8 pt-5"
//       >
//         {/* Destination context */}
//         <View className="mb-6">
//           <AppText className="text-sm text-text-secondary">
//             Directions to
//           </AppText>

//           {businessQuery.isLoading && !businessQuery.business ? (
//             <View className="mt-2 h-7 w-48 rounded-full bg-border-primary" />
//           ) : (
//             <AppText
//               weight="extrabold"
//               className="mt-1 text-2xl text-text-primary"
//             >
//               {businessName}
//             </AppText>
//           )}
//         </View>

//         {/* Transportation options */}
//         <RoadRouteEntryCard
//           onViewRoute={() => {
//             router.push({
//               pathname: "/(explorer)/business/[businessId]/road-route",
//               params: {
//                 businessId: String(businessId),
//               },
//             });
//           }}
//         />

//         <JeepneyGuideEntryCard
//           onViewGuide={() => {
//             router.push({
//               pathname: "/(explorer)/business/[businessId]/jeepney-guide",
//               params: {
//                 businessId: String(businessId),
//               },
//             });
//           }}
//         />

//         <GrabHandoffCard />
//       </ScrollView>
//     </SafeAreaView>
//   );
// }
