import { Slot } from "expo-router";

import { useAuthGuard } from "@/features/auth/hooks/useAuthGuard";

export default function ExplorerLayout() {
  useAuthGuard();

  return <Slot />;
}
