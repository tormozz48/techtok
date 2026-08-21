import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
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

  console.log(`Discovering Users/UserActivity table names for stage "${stage}"...`);
  const usersTableName = await discoverTableName(stage, 'Users');
  const userActivityTableName = await discoverTableName(stage, 'UserActivity');
  console.log(`  Users:         ${usersTableName}`);
  console.log(`  UserActivity:  ${userActivityTableName}`);

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  console.log('Scanning both tables (this is the full-content backup)...');
  const users = await scanAll(client, usersTableName);
  const userActivity = await scanAll(client, userActivityTableName);

  mkdirSync(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = resolve(BACKUP_DIR, `wipeUsers-${stage}-${timestamp}.json`);
  writeFileSync(backupPath, JSON.stringify({ stage, users, userActivity }, null, 2));

  console.log(`\nBackup written to ${backupPath}`);
  console.log(`  Users rows:         ${users.length}`);
  console.log(`  UserActivity rows:  ${userActivity.length}`);

  if (!confirm) {
    console.log('\nDry run only (pass --confirm to actually delete). Nothing was changed.');
    return;
  }

  console.log(`\n--confirm given — deleting ${users.length + userActivity.length} rows...`);
  await deleteAll(client, usersTableName, users, ['userId']);
  await deleteAll(client, userActivityTableName, userActivity, ['userId', 'sk']);
  console.log('Done. Both tables are empty.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
