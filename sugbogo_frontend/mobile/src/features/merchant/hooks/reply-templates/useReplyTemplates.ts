import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { throwOnApiError } from "@/shared/utils/throwOnApiError";

import * as replyTemplateService from "../../api/replyTemplate.service";
import type { ReplyTemplate } from "../../types/reply-templates/replyTemplate.types";

export const replyTemplatesKey = () => ["reply-templates"] as const;

/**
 * Retrieves and manages the merchant's reusable review reply templates.
 *
 * Mutations invalidate the template collection so the UI always reflects
 * the latest saved templates after create, update, or delete operations.
 */
export function useReplyTemplates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: replyTemplatesKey(),
    queryFn: async (): Promise<ReplyTemplate[]> =>
      throwOnApiError(await replyTemplateService.getReplyTemplates()),
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, text }: { title: string; text: string }) =>
      throwOnApiError(
        await replyTemplateService.createReplyTemplate(title, text),
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: replyTemplatesKey(),
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      templateId,
      title,
      text,
    }: {
      templateId: number;
      title?: string;
      text?: string;
    }) =>
      throwOnApiError(
        await replyTemplateService.updateReplyTemplate(templateId, title, text),
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: replyTemplatesKey(),
      });
    },
  });

  const deleteMutation = useDeleteReplyTemplate();

  return {
    templates: query.data ?? [],
    hasData: query.data !== undefined,
    isLoading: query.isLoading,
    isRefetching: query.isRefetching,
    error: query.error,
    refetch: query.refetch,

    createTemplate: createMutation.mutate,
    createTemplateAsync: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,

    updateTemplate: updateMutation.mutate,
    updateTemplateAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    deleteTemplate: deleteMutation.mutate,
    deleteTemplateAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  };
}

/** Deletes a template without subscribing to the collection read. */
export function useDeleteReplyTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId }: { templateId: number }) =>
      throwOnApiError(
        await replyTemplateService.deleteReplyTemplate(templateId),
      ),

    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: replyTemplatesKey(),
      });
    },
  });
}
