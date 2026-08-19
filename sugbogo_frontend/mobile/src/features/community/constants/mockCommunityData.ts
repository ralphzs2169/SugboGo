export type CommunityPost = {
  id: string;
  userName: string;
  userAvatarUrl: string;
  timeAgo: string;
  photoUrl: string;
  tags: string[];
  comment: string;
  helpfulCount: number;
  repliesCount: number;
  msmeName: string;
  msmeLocation: string;
  msmeCategory: "Culinary" | "Leisure" | "Creative";
  msmePhotoUrl: string;
};

export const MOCK_COMMUNITY_POSTS: CommunityPost[] = [
  {
    id: "1",
    userName: "Ralph Guiral",
    userAvatarUrl: "https://i.pravatar.cc/100?img=12",
    timeAgo: "2 hours ago",
    photoUrl: "https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?w=600&h=500&fit=crop",
    tags: ["NATURE SPOT", "SCENIC VIEW"],
    comment:
      "Grabe pagka nindot sa punoan ni Charmaine, presko kaayong hangin unya top tier ang view, such a hidden gem!",
    helpfulCount: 48,
    repliesCount: 8,
    msmeName: "Punoan ni Charmaine",
    msmeLocation: "Guba, Cebu",
    msmeCategory: "Leisure",
    msmePhotoUrl: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=100&h=100&fit=crop",
  },
  {
    id: "2",
    userName: "Juan D.",
    userAvatarUrl: "https://i.pravatar.cc/100?img=33",
    timeAgo: "16 hours ago",
    photoUrl: "https://images.unsplash.com/photo-1528495612343-9ca9f4a4de28?w=600&h=500&fit=crop",
    tags: ["TRADITIONAL COOKING", "CULTURAL LANDMARK"],
    comment:
      "This place feels like stepping back in time. The food tasted authentic and homemade, and you can really feel the history in both the recipes and the atmosphere.",
    helpfulCount: 34,
    repliesCount: 5,
    msmeName: "Talamban Heritage Resto",
    msmeLocation: "Talamban, Cebu",
    msmeCategory: "Culinary",
    msmePhotoUrl: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=100&h=100&fit=crop",
  },
];