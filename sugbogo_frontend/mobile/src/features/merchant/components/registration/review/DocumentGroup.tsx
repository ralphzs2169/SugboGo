import { View } from "react-native";
import DocumentPreview from "../verification-documents/DocumentPreview";
import { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";
import AppText from "@/shared/components/AppText";

type DocumentGroupProps = {
  title: string;
  document?: BusinessDocument | null;
  documents?: BusinessDocument[];
};

export default function DocumentGroup({
  title,
  document,
  documents,
}: DocumentGroupProps) {
  const count = documents?.length ?? (document ? 1 : 0);

  return (
    <View className="mb-3 rounded-xl bg-surface-muted p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <AppText weight="semibold" className="text-sm  text-text-primary">
          {title}
        </AppText>
        {count > 0 && (
          <AppText className="text-xs text-text-secondary">
            {count} {count === 1 ? "document" : "documents"}
          </AppText>
        )}
      </View>

      {documents ? (
        <View className="gap-2">
          {documents.map((item, index) => (
            <DocumentPreview
              key={`${item.uri}-${index}`}
              document={item}
              showRemove={false}
              className="bg-surface"
            />
          ))}
        </View>
      ) : document ? (
        <DocumentPreview
          document={document}
          showRemove={false}
          className="bg-surface"
        />
      ) : (
        <View className="items-center justify-center rounded-lg border border-dashed border-border-primary py-4">
          <AppText className="text-sm text-text-secondary">
            Not provided
          </AppText>
        </View>
      )}
    </View>
  );
}
