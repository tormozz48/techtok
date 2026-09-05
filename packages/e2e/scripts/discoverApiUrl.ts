import { discoverStageResources, getApiEndpoint } from '../src/awsDiscovery';

const stage = process.argv[2] ?? 'production';
const resources = await discoverStageResources(stage);
const endpoint = await getApiEndpoint(resources.apiId);
process.stdout.write(endpoint);
