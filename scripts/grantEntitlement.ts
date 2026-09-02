import { createSqlClient, type Entitlement, UsersRepo } from '@techtok/core';

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

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      `DATABASE_URL is not set. Export the "${stage}" stage's Neon connection string first ` +
        '(the same value set via `sst secret set NeonDatabaseUrl`).',
    );
  }

  const repo = new UsersRepo(createSqlClient(databaseUrl));
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
