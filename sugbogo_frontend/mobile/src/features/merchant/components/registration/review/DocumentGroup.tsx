import { View, Text } from "react-native";
import DocumentPreview from "../verification-documents/DocumentPreview";
import { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";

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
    <View className="mb-5">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">{title}</Text>
        {count > 0 && (
          <Text className="text-xs text-text-secondary">
            {count} {count === 1 ? "document" : "documents"}
          </Text>
        )}
      </View>

      <View className="-mt-2 mb-3 border-t border-border-primary" />

      {documents ? (
        <View className="gap-2">
          {documents.map((item, index) => (
            <DocumentPreview
              key={`${item.uri}-${index}`}
              document={item}
              showRemove={false}
            />
          ))}
        </View>
      ) : document ? (
        <DocumentPreview document={document} showRemove={false} />
      ) : (
        <View className="items-center justify-center rounded-lg border border-dashed border-border-primary py-4">
          <Text className="text-sm text-text-secondary">Not provided</Text>
        </View>
      )}
    </View>
  );
}
