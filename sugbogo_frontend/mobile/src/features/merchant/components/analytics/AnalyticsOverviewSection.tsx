import type { ReactNode } from "react";
import AppText from "@/shared/components/AppText";
import MerchantContentSection from "../../layout/MerchantContentSection";

/** Uses the merchant profile's full-width section layout for analytics content. */
export default function AnalyticsOverviewSection({
  title,
  description,
  accessory,
  flushTop = false,
  plus = false,
  children,
}: {
  title: string;
  description?: string;
  accessory?: ReactNode;
  flushTop?: boolean;
  plus?: boolean;
  children: ReactNode;
}) {
  return (
    <MerchantContentSection
      title={title}
      description={description}
      flushTop={flushTop}
      accessory={
        accessory ??
        (plus ? (
          <AppText weight="bold" className="text-sm text-brand">
            Plus
          </AppText>
        ) : undefined)
      }
    >
      {children}
    </MerchantContentSection>
  );
}
