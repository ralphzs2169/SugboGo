export const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  AUTHENTIC: { bg: "bg-orange-500", text: "text-white" },
  HERITAGE: { bg: "bg-teal-700", text: "text-white" },
  HANDCRAFTED: { bg: "bg-purple-500", text: "text-white" },
  LOCAL: { bg: "bg-green-600", text: "text-white" },
  NATURE: { bg: "bg-green-600", text: "text-white" },
  ADVENTURE: { bg: "bg-blue-600", text: "text-white" },
  SCENIC: { bg: "bg-blue-600", text: "text-white" },
};

// Fallback for any tag not listed above
export const DEFAULT_TAG_COLOR = { bg: "bg-black/50", text: "text-white" };