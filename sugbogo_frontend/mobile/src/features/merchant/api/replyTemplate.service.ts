import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";
import type { ApiResponse } from "@/shared/types/apiResponse.types";

import type { ReplyTemplate } from "../types/reply-templates/replyTemplate.types";

export function getReplyTemplates(): Promise<ApiResponse<ReplyTemplate[]>> {
  return request(apiClient.get("/reviews/reply-templates/"));
}

export function createReplyTemplate(
  title: string,
  text: string,
): Promise<ApiResponse<ReplyTemplate>> {
  return request(
    apiClient.post("/reviews/reply-templates/", {
      title,
      text,
    }),
  );
}

export function updateReplyTemplate(
  templateId: number,
  title?: string,
  text?: string,
): Promise<ApiResponse<ReplyTemplate>> {
  return request(
    apiClient.patch(`/reviews/reply-templates/${templateId}/`, {
      ...(title !== undefined && { title }),
      ...(text !== undefined && { text }),
    }),
  );
}

export function deleteReplyTemplate(
  templateId: number,
): Promise<ApiResponse<null>> {
  return request(apiClient.delete(`/reviews/reply-templates/${templateId}/`));
}
