import { discoverDevResources, getApiEndpoint } from '../src/awsDiscovery';

const stage = process.argv[2] ?? 'dev';
const resources = await discoverDevResources(stage);
const endpoint = await getApiEndpoint(resources.apiId);
process.stdout.write(endpoint);
