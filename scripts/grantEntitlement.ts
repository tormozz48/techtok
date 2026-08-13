import { createDynamoClient, type Entitlement, UsersRepo } from '@techtok/core';
import { discoverTableName } from './lib/discoverTableName';

/**
 * Grant/revoke `plus` for one user (D70) — this is how the maintainer tests
 * the paid path in phase 20 (no payment code exists yet) and comps accounts
 * afterward. Writes through the exact same `UsersRepo.grantEntitlement` path
 * Play's verify callback will use in phase 21, so nothing here is
 * throwaway scaffolding.
 *
 * Usage (from repo root, with AWS credentials for the target stage active —
 * e.g. `AWS_PROFILE=techtok`):
 *
 *   pnpm exec tsx scripts/grantEntitlement.ts --stage dev --user-id g:1234567890 --plan plus
 *     Grants Plus with no expiry (an open-ended manual grant).
 *
 *   pnpm exec tsx scripts/grantEntitlement.ts --stage dev --user-id g:1234567890 --plan plus --expires-at 2026-09-01T00:00:00.000Z
 *     Grants Plus until a specific instant — useful for testing the
 *     expiry-lapses-back-to-free path without waiting a month.
 *
 *   pnpm exec tsx scripts/grantEntitlement.ts --stage dev --user-id g:1234567890 --plan free
 *     Revokes Plus (sets plan back to free).
 */

interface Args {
  stage: string;
  userId: string;
  plan: 'free' | 'plus';
  expiresAt?: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const stage = get('--stage');
  const userId = get('--user-id');
  const plan = get('--plan');
  const expiresAt = get('--expires-at');

  if (!stage || !userId || (plan !== 'free' && plan !== 'plus')) {
    throw new Error(
      'Usage: tsx scripts/grantEntitlement.ts --stage <dev|production> --user-id <userId> --plan <free|plus> [--expires-at <ISO instant>]',
    );
  }
  return { stage, userId, plan, expiresAt };
}

async function main(): Promise<void> {
  const { stage, userId, plan, expiresAt } = parseArgs(process.argv.slice(2));

  console.log(`Discovering the Users table for stage "${stage}"...`);
  const usersTableName = await discoverTableName(stage, 'Users');
  console.log(`  Users: ${usersTableName}`);

  const repo = new UsersRepo(createDynamoClient(), usersTableName);
  const entitlement: Entitlement = {
    plan,
    source: 'manual',
    expiresAt,
    verifiedAt: new Date().toISOString(),
  };

  const user = await repo.grantEntitlement(userId, entitlement);

  console.log(`\n${plan === 'plus' ? 'Granted' : 'Revoked'} for ${userId}:`);
  console.log(JSON.stringify(user.entitlement, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
