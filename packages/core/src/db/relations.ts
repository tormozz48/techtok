import { relations } from 'drizzle-orm';
import {
  postCompacts,
  postFigures,
  posts,
  postTopics,
  postTranslations,
  sources,
  userBookmarks,
  userEntitlements,
  userMutedSources,
  userQuotas,
  userReads,
  users,
  userTopicReads,
  userTopics,
} from './schema';

export const sourcesRelations = relations(sources, ({ many }) => ({
  posts: many(posts),
  mutedBy: many(userMutedSources),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  source: one(sources, { fields: [posts.sourceId], references: [sources.sourceId] }),
  duplicateOfPost: one(posts, { fields: [posts.duplicateOf], references: [posts.postId] }),
  translations: many(postTranslations),
  topics: many(postTopics),
  compacts: many(postCompacts),
  figures: many(postFigures),
}));

export const postTranslationsRelations = relations(postTranslations, ({ one }) => ({
  post: one(posts, { fields: [postTranslations.postId], references: [posts.postId] }),
}));

export const postTopicsRelations = relations(postTopics, ({ one }) => ({
  post: one(posts, { fields: [postTopics.postId], references: [posts.postId] }),
}));

export const postCompactsRelations = relations(postCompacts, ({ one }) => ({
  post: one(posts, { fields: [postCompacts.postId], references: [posts.postId] }),
}));

export const postFiguresRelations = relations(postFigures, ({ one }) => ({
  post: one(posts, { fields: [postFigures.postId], references: [posts.postId] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  topics: many(userTopics),
  mutedSources: many(userMutedSources),
  topicReads: many(userTopicReads),
  quotas: many(userQuotas),
  entitlement: one(userEntitlements, {
    fields: [users.userId],
    references: [userEntitlements.userId],
  }),
  reads: many(userReads),
  bookmarks: many(userBookmarks),
}));

export const userTopicsRelations = relations(userTopics, ({ one }) => ({
  user: one(users, { fields: [userTopics.userId], references: [users.userId] }),
}));

export const userMutedSourcesRelations = relations(userMutedSources, ({ one }) => ({
  user: one(users, { fields: [userMutedSources.userId], references: [users.userId] }),
  source: one(sources, { fields: [userMutedSources.sourceId], references: [sources.sourceId] }),
}));

export const userTopicReadsRelations = relations(userTopicReads, ({ one }) => ({
  user: one(users, { fields: [userTopicReads.userId], references: [users.userId] }),
}));

export const userQuotasRelations = relations(userQuotas, ({ one }) => ({
  user: one(users, { fields: [userQuotas.userId], references: [users.userId] }),
}));

export const userEntitlementsRelations = relations(userEntitlements, ({ one }) => ({
  user: one(users, { fields: [userEntitlements.userId], references: [users.userId] }),
}));

export const userReadsRelations = relations(userReads, ({ one }) => ({
  user: one(users, { fields: [userReads.userId], references: [users.userId] }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
  user: one(users, { fields: [userBookmarks.userId], references: [users.userId] }),
}));
