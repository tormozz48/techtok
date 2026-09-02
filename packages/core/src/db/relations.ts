import { relations } from 'drizzle-orm';
import {
  postCompacts,
  postFigures,
  posts,
  postTopics,
  postTranslations,
  sourceStates,
  sources,
  topics,
  userBookmarks,
  userEntitlements,
  userMutedSources,
  userQuotas,
  userReads,
  users,
  userTopicReads,
  userTopics,
} from './schema';

export const topicsRelations = relations(topics, ({ many }) => ({
  posts: many(posts),
  postTopics: many(postTopics),
  userTopics: many(userTopics),
  userTopicReads: many(userTopicReads),
  defaultForSources: many(sources),
}));

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  defaultTopic: one(topics, { fields: [sources.defaultTopicId], references: [topics.id] }),
  state: one(sourceStates, { fields: [sources.id], references: [sourceStates.sourceId] }),
  posts: many(posts),
}));

export const sourceStatesRelations = relations(sourceStates, ({ one }) => ({
  source: one(sources, { fields: [sourceStates.sourceId], references: [sources.id] }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  source: one(sources, { fields: [posts.sourceId], references: [sources.id] }),
  primaryTopic: one(topics, { fields: [posts.primaryTopicId], references: [topics.id] }),
  duplicateOfPost: one(posts, { fields: [posts.duplicateOfPostId], references: [posts.id] }),
  translations: many(postTranslations),
  topics: many(postTopics),
  compacts: many(postCompacts),
  figures: many(postFigures),
}));

export const postTranslationsRelations = relations(postTranslations, ({ one }) => ({
  post: one(posts, { fields: [postTranslations.postId], references: [posts.id] }),
}));

export const postTopicsRelations = relations(postTopics, ({ one }) => ({
  post: one(posts, { fields: [postTopics.postId], references: [posts.id] }),
  topic: one(topics, { fields: [postTopics.topicId], references: [topics.id] }),
}));

export const postCompactsRelations = relations(postCompacts, ({ one }) => ({
  post: one(posts, { fields: [postCompacts.postId], references: [posts.id] }),
}));

export const postFiguresRelations = relations(postFigures, ({ one }) => ({
  post: one(posts, { fields: [postFigures.postId], references: [posts.id] }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  topics: many(userTopics),
  mutedSources: many(userMutedSources),
  topicReads: many(userTopicReads),
  quotas: many(userQuotas),
  entitlement: one(userEntitlements, {
    fields: [users.id],
    references: [userEntitlements.userId],
  }),
  reads: many(userReads),
  bookmarks: many(userBookmarks),
}));

export const userTopicsRelations = relations(userTopics, ({ one }) => ({
  user: one(users, { fields: [userTopics.userId], references: [users.id] }),
  topic: one(topics, { fields: [userTopics.topicId], references: [topics.id] }),
}));

export const userMutedSourcesRelations = relations(userMutedSources, ({ one }) => ({
  user: one(users, { fields: [userMutedSources.userId], references: [users.id] }),
}));

export const userTopicReadsRelations = relations(userTopicReads, ({ one }) => ({
  user: one(users, { fields: [userTopicReads.userId], references: [users.id] }),
  topic: one(topics, { fields: [userTopicReads.topicId], references: [topics.id] }),
}));

export const userQuotasRelations = relations(userQuotas, ({ one }) => ({
  user: one(users, { fields: [userQuotas.userId], references: [users.id] }),
}));

export const userEntitlementsRelations = relations(userEntitlements, ({ one }) => ({
  user: one(users, { fields: [userEntitlements.userId], references: [users.id] }),
}));

export const userReadsRelations = relations(userReads, ({ one }) => ({
  user: one(users, { fields: [userReads.userId], references: [users.id] }),
  primaryTopic: one(topics, { fields: [userReads.primaryTopicId], references: [topics.id] }),
}));

export const userBookmarksRelations = relations(userBookmarks, ({ one }) => ({
  user: one(users, { fields: [userBookmarks.userId], references: [users.id] }),
  primaryTopic: one(topics, { fields: [userBookmarks.primaryTopicId], references: [topics.id] }),
}));
