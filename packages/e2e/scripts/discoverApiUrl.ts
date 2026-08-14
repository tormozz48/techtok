/**
 * Prints the deployed API Gateway endpoint for a stage, discovered the same
 * way the HTTP-level E2E suites already do (see ../src/awsDiscovery.ts) —
 * by walking the `app: techtok-<stage>` resource tag (DESIGN §2 D17) rather
 * than guessing at a generated physical name.
 *
 * Used by scripts/buildE2eApk.sh to bake a real API URL into the mobile
 * E2E build. Requires AWS credentials for the target stage.
 *
 * Usage: tsx scripts/discoverApiUrl.ts [stage]   (stage defaults to "dev")
 */
import { discoverDevResources, getApiEndpoint } from '../src/awsDiscovery';

const stage = process.argv[2] ?? 'dev';
const resources = await discoverDevResources(stage);
const endpoint = await getApiEndpoint(resources.apiId);
process.stdout.write(endpoint);
