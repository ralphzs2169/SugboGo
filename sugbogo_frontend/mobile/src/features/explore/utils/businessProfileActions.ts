import { Linking, Share } from "react-native";
import Toast from "react-native-toast-message";

import type { ExploreBusiness } from "../types/exploreBusiness.types";
import { getBusinessAddressDisplay } from "./businessLocation.utils";

/** Accepts merchant web addresses without allowing native or executable schemes. */
export function normalizeBusinessWebsite(value: string | null): string | null {
  const input = value?.trim();
  if (!input || /[\s\u0000-\u001f\u007f\\]/.test(input)) return null;

  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(input);
  const address = hasScheme
    ? input
    : `https:${input.startsWith("//") ? "" : "//"}${input}`;
  try {
    const url = new URL(address);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

/** Opens only a validated website and reports native handoff failures locally. */
export async function openBusinessWebsite(website: string) {
  const url = normalizeBusinessWebsite(website);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    Toast.show({
      type: "error",
      text1: "Unable to open website",
      text2: "Please try again.",
    });
  }
}

/** Shares useful profile text without claiming an unconfigured public profile URL. */
export async function shareBusinessProfile(
  business: Pick<
    ExploreBusiness,
    "business_name" | "cluster" | "category" | "location"
  >,
) {
  const address = getBusinessAddressDisplay(business.location);
  const message = [
    business.business_name,
    `${business.cluster.name} · ${business.category.name}`,
    [address.addressLine, address.cityLine].filter(Boolean).join(", "),
    "Discover this place on SugboGo.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await Share.share({ message });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return;
    Toast.show({
      type: "error",
      text1: "Unable to share this place",
      text2: "Please try again.",
    });
  }
}
