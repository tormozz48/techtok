import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSqlClient } from '@techtok/core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = resolve(__dirname, '../ops-backups');

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

async function main(): Promise<void> {
  const { stage, confirm } = parseArgs(process.argv.slice(2));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Export the "${stage}" stage's Neon connection string first ` +
        '(the same value set via `sst secret set NeonDatabaseUrl`).',
    );
  }
  const db = createSqlClient(databaseUrl);

  console.log('Backing up every per-user Postgres table...');
  const [
    usersRows,
    userTopicsRows,
    mutedSourcesRows,
    topicReadsRows,
    quotasRows,
    entitlementsRows,
    readsRows,
    bookmarksRows,
  ] = await Promise.all([
    db.execute('select * from users'),
    db.execute('select * from user_topics'),
    db.execute('select * from user_muted_sources'),
    db.execute('select * from user_topic_reads'),
    db.execute('select * from user_quotas'),
    db.execute('select * from user_entitlements'),
    db.execute('select * from user_reads'),
    db.execute('select * from user_bookmarks'),
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
        userReads: readsRows.rows,
        userBookmarks: bookmarksRows.rows,
      },
      null,
      2,
    ),
  );

  console.log(`\nBackup written to ${backupPath}`);
  console.log(`  Users rows:          ${usersRows.rows.length}`);
  console.log(`  user_reads rows:     ${readsRows.rows.length}`);
  console.log(`  user_bookmarks rows: ${bookmarksRows.rows.length}`);

  if (!confirm) {
    console.log('\nDry run only (pass --confirm to actually delete). Nothing was changed.');
    return;
  }

  console.log(
    `\n--confirm given — deleting ${usersRows.rows.length} users ` +
      '(cascades to their topics/muted-sources/topic-reads/quotas/entitlements/reads/bookmarks)...',
  );
  await db.execute('delete from users');
  console.log('Done. Every per-user table is empty.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
