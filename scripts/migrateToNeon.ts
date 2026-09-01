import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createSqlClient } from '@techtok/core';
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
} from '../packages/core/src/db/schema';
import { discoverTableName, REGION } from './lib/discoverTableName';
import {
  isBookmarkRow,
  isReadRow,
  transformActivity,
  transformPost,
  transformSource,
  transformUser,
} from './lib/migrationTransforms';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, '../ops-backups');
const INSERT_BATCH_SIZE = 500;

interface Args {
  stage: string;
  confirm: boolean;
}

function parseArgs(argv: string[]): Args {
  const stageIndex = argv.indexOf('--stage');
  const stage = stageIndex >= 0 ? argv[stageIndex + 1] : undefined;
  if (!stage) {
    throw new Error('Usage: tsx scripts/migrateToNeon.ts --stage <dev|production> [--confirm]');
  }
  return { stage, confirm: argv.includes('--confirm') };
}

async function scanAll(
  client: DynamoDBDocumentClient,
  tableName: string,
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const page = await client.send(
      new ScanCommand({ TableName: tableName, ExclusiveStartKey: exclusiveStartKey }),
    );
    items.push(...((page.Items ?? []) as Record<string, unknown>[]));
    exclusiveStartKey = page.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function main(): Promise<void> {
  const { stage, confirm } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Export the "${stage}" stage's Neon connection string first.`,
    );
  }
  const db = createSqlClient(databaseUrl);

  console.log(`Discovering DynamoDB table names for stage "${stage}"...`);
  const [sourcesTableName, postsTableName, usersTableName, userActivityTableName] =
    await Promise.all([
      discoverTableName(stage, 'Sources'),
      discoverTableName(stage, 'Posts'),
      discoverTableName(stage, 'Users'),
      discoverTableName(stage, 'UserActivity'),
    ]);
  console.log(`  Sources:      ${sourcesTableName}`);
  console.log(`  Posts:        ${postsTableName}`);
  console.log(`  Users:        ${usersTableName}`);
  console.log(`  UserActivity: ${userActivityTableName}`);

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  console.log('\nScanning all four DynamoDB tables (this is the full-content backup)...');
  const [sourceItems, postItems, userItems, activityItems] = await Promise.all([
    scanAll(dynamo, sourcesTableName),
    scanAll(dynamo, postsTableName),
    scanAll(dynamo, usersTableName),
    scanAll(dynamo, userActivityTableName),
  ]);

  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(BACKUP_DIR, `migrateToNeon-${stage}-${timestamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify({ stage, sourceItems, postItems, userItems, activityItems }, null, 2),
  );
  console.log(`Backup written to ${backupPath}`);

  console.log('\nTransforming and auditing...');
  const sourceResults = sourceItems.map(transformSource);
  const postResults = postItems.map(transformPost);
  const userResults = userItems.map(transformUser);
  const readResults = activityItems.filter(isReadRow).map(transformActivity);
  const bookmarkResults = activityItems.filter(isBookmarkRow).map(transformActivity);

  const violationGroups: [string, { violations: string[] }[]][] = [
    ['Sources', sourceResults],
    ['Posts', postResults],
    ['Users', userResults],
    ['UserActivity (reads)', readResults],
    ['UserActivity (bookmarks)', bookmarkResults],
  ];

  let totalViolations = 0;
  for (const [label, results] of violationGroups) {
    const withViolations = results.filter((r) => r.violations.length > 0);
    if (withViolations.length === 0) continue;
    totalViolations += withViolations.length;
    console.log(`\n  ${label}: ${withViolations.length} row(s) skipped`);
    for (const r of withViolations.slice(0, 20)) {
      console.log(`    - ${r.violations.join('; ')}`);
    }
    if (withViolations.length > 20) console.log(`    ... and ${withViolations.length - 20} more`);
  }

  const validSources = sourceResults.flatMap((r) => (r.row ? [r.row] : []));
  const validPosts = postResults.flatMap((r) => (r.row ? [r.row] : []));
  const validUsers = userResults.flatMap((r) => (r.row ? [r.row] : []));
  const validReads = readResults.flatMap((r) => (r.row ? [r.row] : []));
  const validBookmarks = bookmarkResults.flatMap((r) => (r.row ? [r.row] : []));

  console.log('\nCounts:');
  console.log(`  Sources:   ${validSources.length} / ${sourceItems.length} scanned`);
  console.log(`  Posts:     ${validPosts.length} / ${postItems.length} scanned`);
  console.log(`  Users:     ${validUsers.length} / ${userItems.length} scanned`);
  console.log(
    `  Reads:     ${validReads.length} / ${activityItems.filter(isReadRow).length} scanned`,
  );
  console.log(
    `  Bookmarks: ${validBookmarks.length} / ${activityItems.filter(isBookmarkRow).length} scanned`,
  );
  if (totalViolations > 0) {
    console.log(
      `\n${totalViolations} row(s) across all tables were skipped -- review the violations above before deciding whether to --confirm.`,
    );
  }

  if (!confirm) {
    console.log('\nDry run only (pass --confirm to actually write). Nothing was changed.');
    return;
  }

  console.log('\n--confirm given -- writing to Postgres...');

  for (const batch of chunk(validSources, INSERT_BATCH_SIZE)) {
    await db.insert(sources).values(batch).onConflictDoNothing();
  }
  console.log(`  Sources written: ${validSources.length}`);

  for (const batch of chunk(validUsers, INSERT_BATCH_SIZE)) {
    await db
      .insert(users)
      .values(batch.map((u) => u.user))
      .onConflictDoNothing();
  }
  for (const user of validUsers) {
    if (user.topics.length > 0) {
      await db.insert(userTopics).values(user.topics).onConflictDoNothing();
    }
    if (user.mutedSources.length > 0) {
      await db.insert(userMutedSources).values(user.mutedSources).onConflictDoNothing();
    }
    if (user.topicReads.length > 0) {
      await db.insert(userTopicReads).values(user.topicReads).onConflictDoNothing();
    }
    if (user.quota) await db.insert(userQuotas).values(user.quota).onConflictDoNothing();
    if (user.entitlement) {
      await db.insert(userEntitlements).values(user.entitlement).onConflictDoNothing();
    }
  }
  console.log(`  Users written: ${validUsers.length}`);

  for (const batch of chunk(validPosts, INSERT_BATCH_SIZE)) {
    await db
      .insert(posts)
      .values(batch.map((p) => p.post))
      .onConflictDoNothing();
  }
  for (const batch of chunk(
    validPosts.flatMap((p) => p.translations),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(postTranslations).values(batch).onConflictDoNothing();
  }
  for (const batch of chunk(
    validPosts.flatMap((p) => p.topics),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(postTopics).values(batch).onConflictDoNothing();
  }
  for (const batch of chunk(
    validPosts.flatMap((p) => p.compacts),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(postCompacts).values(batch).onConflictDoNothing();
  }
  for (const batch of chunk(
    validPosts.flatMap((p) => p.figures),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(postFigures).values(batch).onConflictDoNothing();
  }
  console.log(`  Posts written: ${validPosts.length}`);

  for (const batch of chunk(
    validReads.map((r) => ({
      userId: r.userId,
      postId: r.postId,
      readAt: r.at,
      cardTitle: r.cardTitle,
      sourceName: r.sourceName,
      url: r.url,
      primaryTopic: r.primaryTopic,
    })),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(userReads).values(batch).onConflictDoNothing();
  }
  console.log(`  Reads written: ${validReads.length}`);

  for (const batch of chunk(
    validBookmarks.map((b) => ({
      userId: b.userId,
      postId: b.postId,
      bookmarkedAt: b.at,
      cardTitle: b.cardTitle,
      sourceName: b.sourceName,
      url: b.url,
      primaryTopic: b.primaryTopic,
    })),
    INSERT_BATCH_SIZE,
  )) {
    await db.insert(userBookmarks).values(batch).onConflictDoNothing();
  }
  console.log(`  Bookmarks written: ${validBookmarks.length}`);

  console.log('\nDone. Verify row-count parity before decommissioning the DynamoDB tables.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
