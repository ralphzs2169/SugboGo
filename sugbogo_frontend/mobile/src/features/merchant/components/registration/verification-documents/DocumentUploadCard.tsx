import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";

import DocumentPreview from "./DocumentPreview";
import { pickBusinessDocuments } from "./DocumentPicker";
import type { BusinessDocument } from "@/features/merchant/types/registration/registrationOption.types";
import { theme } from "@/constants/theme";

type DocumentUploadCardProps = {
  document?: BusinessDocument | null;
  documents?: BusinessDocument[];
  multiple?: boolean;
  maxDocuments?: number;
  required?: boolean;
  error?: string;
  onDocumentChange?: (document: BusinessDocument | null) => void;
  onDocumentsChange?: (documents: BusinessDocument[]) => void;
};

/**
 * Provides a document upload interface for merchant registration.
 *
 * Supports single and multiple document uploads, displays selected documents,
 * and handles adding and removing documents.
 */
export default function DocumentUploadCard({
  document = null,
  documents = [],
  multiple = false,
  maxDocuments = 1,
  required = false,
  error,
  onDocumentChange,
  onDocumentsChange,
}: DocumentUploadCardProps) {
  const [isPicking, setIsPicking] = useState(false);

  const currentDocuments = multiple ? documents : document ? [document] : [];

  const canAddMore = currentDocuments.length < maxDocuments;

  const handleAddDocument = async () => {
    if (!canAddMore || isPicking) {
      return;
    }

    setIsPicking(true);

    try {
      const selectedDocuments = await pickBusinessDocuments({
        currentCount: currentDocuments.length,
        maxDocuments,
      });

      if (selectedDocuments.length === 0) {
        return;
      }

      if (multiple) {
        onDocumentsChange?.([...documents, ...selectedDocuments]);
        return;
      }

      onDocumentChange?.(selectedDocuments[0]);
    } finally {
      setIsPicking(false);
    }
  };

  const handleRemoveDocument = (index: number) => {
    if (multiple) {
      onDocumentsChange?.(
        documents.filter((_, documentIndex) => documentIndex !== index),
      );
      return;
    }

    onDocumentChange?.(null);
  };

  return (
    <View
      className={`rounded-md border px-4 py-4 ${
        error ? "border-border-error bg-error" : "border-border-primary"
      }`}
    >
      {currentDocuments.length > 0 && (
        <View className="gap-2">
          {currentDocuments.map((item, index) => (
            <DocumentPreview
              key={`${item.uri}-${index}`}
              document={item}
              onRemove={() => handleRemoveDocument(index)}
            />
          ))}
        </View>
      )}

      {canAddMore && (
        <Pressable
          onPress={handleAddDocument}
          disabled={isPicking}
          className="mt-3 items-center justify-center rounded-lg border border-dashed border-border-secondary py-5"
        >
          {isPicking ? (
            <ActivityIndicator color={theme.extends.colors.brand} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="cloud-upload-outline"
                size={32}
                color={theme.extends.colors.text.secondary}
              />

              <Text className="mt-2 text-sm font-medium text-text-secondary">
                {currentDocuments.length > 0
                  ? "Add Another Document"
                  : "Upload Document"}
              </Text>

              <Text className="mt-1 text-xs text-text-secondary">
                {required ? "Required" : "Optional"}
                {multiple && ` · Up to ${maxDocuments} documents`}
              </Text>
            </>
          )}
        </Pressable>
      )}
      <Text className="mt-1 text-xs text-text-secondary">PDF, JPG, or PNG</Text>
      {error && <Text className="mt-2 text-sm text-text-error">{error}</Text>}
    </View>
  );
}
