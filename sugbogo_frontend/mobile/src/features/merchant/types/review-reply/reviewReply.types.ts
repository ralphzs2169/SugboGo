export type ReviewPhoto = {
  id: number;
  photo_url: string;
};

export type ReplyPhoto = {
  id: number;
  photo_url: string;
};

export type ReviewReply = {
  id: number;
  text: string;
  created_at: string;
  updated_at: string;
  photos: ReplyPhoto[];
};

export type LocalReviewPhoto = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};
