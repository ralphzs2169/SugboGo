// import { MaterialCommunityIcons } from "@expo/vector-icons";
// import { View } from "react-native";

// import { theme } from "@/constants/theme";
// import AppText from "@/shared/components/AppText";
// import Button from "@/shared/components/Button";

// type Props = {
//   onViewGuide: () => void;
// };

// /** Introduces SugboGo's direct-jeepney guidance as a distinct option. */
// export default function JeepneyGuideEntryCard({ onViewGuide }: Props) {
//   return (
//     <View className="rounded-card border border-border-primary bg-surface p-4">
//       {/* Jeepney-guide identity */}
//       <View className="flex-row items-center">
//         <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
//           <MaterialCommunityIcons
//             name="bus"
//             size={22}
//             color={theme.extends.colors.brand}
//           />
//         </View>

//         <View className="ml-3 flex-1">
//           <AppText weight="bold" className="text-base text-text-primary">
//             Jeepney Guide
//           </AppText>
//           <AppText className="mt-0.5 text-sm leading-5 text-text-secondary">
//             See where to board and get off on a direct jeepney route.
//           </AppText>
//         </View>
//       </View>

//       {/* Guide navigation */}
//       <Button
//         title="View Jeepney Guide"
//         onPress={onViewGuide}
//         rounded="full"
//         variant="soft"
//         className="mt-4 py-3"
//         fontClassName="text-sm"
//         accessibilityLabel="View direct jeepney guide to this business"
//       />
//     </View>
//   );
// }
