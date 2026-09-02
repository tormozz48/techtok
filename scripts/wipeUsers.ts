import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { createSqlClient } from '@techtok/core';
import { discoverTableName, REGION } from './lib/discoverTableName';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, '../ops-backups');
const BATCH_WRITE_CHUNK_SIZE = 25;

interface Args {
  stage: string;
  confirm: boolean;
}

function parseArgs(argv: string[]): Args {
  const stageIndex = argv.indexOf('--stage');
  const stage = stageIndex >= 0 ? argv[stageIndex + 1] : undefined;
  if (!stage) {
    throw new Error('Usage: tsx scripts/wipeUsers.ts --stage <dev|production> [--confirm]');
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

async function deleteAll(
  client: DynamoDBDocumentClient,
  tableName: string,
  items: Record<string, unknown>[],
  keyAttributes: string[],
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_WRITE_CHUNK_SIZE) {
    const batch = items.slice(i, i + BATCH_WRITE_CHUNK_SIZE);
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((item) => ({
            DeleteRequest: {
              Key: Object.fromEntries(keyAttributes.map((attr) => [attr, item[attr]])),
            },
          })),
        },
      }),
    );
  }
}

async function main(): Promise<void> {
  const { stage, confirm } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Export the "${stage}" stage's Neon connection string first ` +
        '(the same value set via `sst secret set NeonDatabaseUrl`) -- Users now lives in ' +
        'Postgres, not DynamoDB (phase 24).',
    );
  }
  const db = createSqlClient(databaseUrl);

  console.log(`Discovering the UserActivity table name for stage "${stage}"...`);
  const userActivityTableName = await discoverTableName(stage, 'UserActivity');
  console.log(`  UserActivity: ${userActivityTableName}`);

  const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  console.log('Backing up all six Postgres user tables and scanning UserActivity...');
  const [
    usersRows,
    userTopicsRows,
    mutedSourcesRows,
    topicReadsRows,
    quotasRows,
    entitlementsRows,
    userActivity,
  ] = await Promise.all([
    db.execute('select * from users'),
    db.execute('select * from user_topics'),
    db.execute('select * from user_muted_sources'),
    db.execute('select * from user_topic_reads'),
    db.execute('select * from user_quotas'),
    db.execute('select * from user_entitlements'),
    scanAll(dynamo, userActivityTableName),
  ]);

  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(BACKUP_DIR, `wipeUsers-${stage}-${timestamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify(
      {
        stage,
        users: usersRows.rows,
        userTopics: userTopicsRows.rows,
        userMutedSources: mutedSourcesRows.rows,
        userTopicReads: topicReadsRows.rows,
        userQuotas: quotasRows.rows,
        userEntitlements: entitlementsRows.rows,
        userActivity,
      },
      null,
      2,
    ),
  );

  console.log(`\nBackup written to ${backupPath}`);
  console.log(`  Users rows:         ${usersRows.rows.length}`);
  console.log(`  UserActivity rows:  ${userActivity.length}`);

  if (!confirm) {
    console.log('\nDry run only (pass --confirm to actually delete). Nothing was changed.');
    return;
  }

  console.log(
    `\n--confirm given — deleting ${usersRows.rows.length} Postgres users ` +
      `(cascades to their topics/muted-sources/topic-reads/quotas/entitlements) ` +
      `and ${userActivity.length} UserActivity rows...`,
  );
  await db.execute('delete from users');
  await deleteAll(dynamo, userActivityTableName, userActivity, ['userId', 'sk']);
  console.log('Done. Users (Postgres) and UserActivity (DynamoDB) are both empty.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
