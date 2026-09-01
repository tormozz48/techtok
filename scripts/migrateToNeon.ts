import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createSqlClient } from '@techtok/core';
import { eq, sql } from 'drizzle-orm';
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
  dropDanglingDuplicates,
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
  reset: boolean;
}

function parseArgs(argv: string[]): Args {
  const stageIndex = argv.indexOf('--stage');
  const stage = stageIndex >= 0 ? argv[stageIndex + 1] : undefined;
  if (!stage) {
    throw new Error(
      'Usage: tsx scripts/migrateToNeon.ts --stage <dev|production> [--confirm] [--reset]',
    );
  }
  return { stage, confirm: argv.includes('--confirm'), reset: argv.includes('--reset') };
}

const RESET_TABLES = ['posts', 'sources', 'users'] as const;

async function resetPostgres(db: ReturnType<typeof createSqlClient>): Promise<void> {
  const counts = await db.execute<{ table_name: string; n: number }>(sql`
    select 'sources' as table_name, count(*)::int as n from sources
    union all select 'posts', count(*)::int from posts
    union all select 'users', count(*)::int from users
  `);
  console.log('Current Postgres row counts (before truncate):');
  for (const row of counts.rows) console.log(`  ${row.table_name}: ${row.n}`);

  console.log(
    `\nTruncating ${RESET_TABLES.join(', ')} (CASCADE also clears every table with an FK into them)...`,
  );
  await db.execute(sql.raw(`truncate table ${RESET_TABLES.join(', ')} restart identity cascade`));
  console.log('Done. Postgres is empty. Re-run without --reset to migrate.');
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
  const { stage, confirm, reset } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Export the "${stage}" stage's Neon connection string first.`,
    );
  }
  const db = createSqlClient(databaseUrl);

  if (reset) {
    if (!confirm) {
      throw new Error('--reset requires --confirm too -- this truncates every migrated table.');
    }
    await resetPostgres(db);
    return;
  }

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
  const validSources = sourceResults.flatMap((r) => (r.row ? [r.row] : []));
  const validSourceIds = new Set(validSources.map((s) => s.sourceId));

  const postResults = postItems.map((item) => transformPost(item, validSourceIds));
  const userResults = userItems.map((item) => transformUser(item, validSourceIds));
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
    console.log(`\n  ${label}: ${withViolations.length} row(s) rejected`);
    for (const r of withViolations.slice(0, 20)) {
      console.log(`    - ${r.violations.join('; ')}`);
    }
    if (withViolations.length > 20) console.log(`    ... and ${withViolations.length - 20} more`);
  }

  const noteGroups: [string, { notes: string[] }[]][] = [
    ['Users', userResults],
    ['Posts', postResults],
  ];
  let totalNotes = 0;
  for (const [label, results] of noteGroups) {
    const withNotes = results.filter((r) => r.notes.length > 0);
    if (withNotes.length === 0) continue;
    totalNotes += withNotes.length;
    console.log(`\n  ${label}: ${withNotes.length} row(s) migrated with a note`);
    for (const r of withNotes.slice(0, 20)) {
      console.log(`    - ${r.notes.join('; ')}`);
    }
    if (withNotes.length > 20) console.log(`    ... and ${withNotes.length - 20} more`);
  }

  const rawValidPosts = postResults.flatMap((r) => (r.row ? [r.row] : []));
  const { rows: validPosts, notes: duplicateNotes } = dropDanglingDuplicates(rawValidPosts);
  if (duplicateNotes.length > 0) {
    totalNotes += duplicateNotes.length;
    console.log(`\n  Posts: ${duplicateNotes.length} dangling duplicateOf reference(s) dropped`);
    for (const note of duplicateNotes.slice(0, 20)) console.log(`    - ${note}`);
    if (duplicateNotes.length > 20) console.log(`    ... and ${duplicateNotes.length - 20} more`);
  }

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
      `\n${totalViolations} row(s) across all tables were rejected -- review the violations above before deciding whether to --confirm.`,
    );
  }
  if (totalNotes > 0) {
    console.log(
      `${totalNotes} row(s) were migrated with a note (a stale reference was dropped, not the whole row) -- review the notes above.`,
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
      .values(batch.map((p) => ({ ...p.post, duplicateOf: null })))
      .onConflictDoNothing();
  }
  const postsWithDuplicateOfToBackfill = validPosts.filter((p) => p.post.duplicateOf);
  for (const post of postsWithDuplicateOfToBackfill) {
    await db
      .update(posts)
      .set({ duplicateOf: post.post.duplicateOf })
      .where(eq(posts.postId, post.post.postId));
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
  console.log(
    `  Posts written: ${validPosts.length} (${postsWithDuplicateOfToBackfill.length} duplicateOf link(s) backfilled)`,
  );

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
