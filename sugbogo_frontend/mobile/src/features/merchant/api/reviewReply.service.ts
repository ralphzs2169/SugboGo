import apiClient from "@/shared/api/apiClient.service";
import { request } from "@/shared/api/request.service";

import type { LocalReviewPhoto } from "../types/review-reply/reviewReply.types";

function appendPhotos(form: FormData, photos: LocalReviewPhoto[]) {
  photos.forEach((photo, index) => {
    form.append("photos", {
      uri: photo.uri,
      name: photo.fileName ?? `reply-${index}.jpg`,
      type: photo.mimeType ?? "image/jpeg",
    } as never);
  });
}

function replyForm(
  text: string,
  photos: LocalReviewPhoto[],
  keepPhotoIds?: number[],
) {
  const form = new FormData();

  form.append("text", text);

  keepPhotoIds?.forEach((id) => {
    form.append("keep_photo_ids", String(id));
  });

  appendPhotos(form, photos);

  return form;
}

export function createReviewReply(
  reviewId: number,
  text: string,
  photos: LocalReviewPhoto[],
) {
  return request(
    apiClient.post(`/reviews/${reviewId}/reply/`, replyForm(text, photos)),
  );
}

export function updateReviewReply(
  replyId: number,
  text: string,
  photos: LocalReviewPhoto[],
  keepPhotoIds: number[],
) {
  return request(
    apiClient.patch(
      `/reviews/replies/${replyId}/`,
      replyForm(text, photos, keepPhotoIds),
    ),
  );
}

export function deleteReviewReply(replyId: number) {
  return request(apiClient.delete(`/reviews/replies/${replyId}/`));
}

export function deleteReplyPhoto(photoId: number) {
  return request(apiClient.delete(`/reviews/reply-photos/${photoId}/`));
}
