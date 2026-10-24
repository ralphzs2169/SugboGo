import { createContext } from "react";
import type { RefObject } from "react";
import type { View } from "react-native";

import type { BusinessImpressionObservation } from "./useBusinessImpressions";

export const BusinessProfileImpressionsContext = createContext<{
  impressions: BusinessImpressionObservation;
  listRef: RefObject<View | null>;
  measureList: () => void;
} | null>(null);
