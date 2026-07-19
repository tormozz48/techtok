export interface ReadSnapshot {
  cardTitle: string;
  sourceName: string;
  url: string;
}

export interface ActivityRecord {
  userId: string;
  sk: string;
  postId: string;
  readAt: string;
  snapshot: ReadSnapshot;
  gsi1sk: string;
}

export interface BookmarkRecord {
  userId: string;
  sk: string;
  postId: string;
  bookmarkedAt: string;
  snapshot: ReadSnapshot;
  gsi2sk: string;
}
