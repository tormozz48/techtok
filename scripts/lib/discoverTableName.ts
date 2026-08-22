import {
  GetResourcesCommand,
  ResourceGroupsTaggingAPIClient,
} from '@aws-sdk/client-resource-groups-tagging-api';

export const REGION = 'eu-central-1';

export async function discoverTableName(
  stage: string,
  logicalNameFragment: string,
): Promise<string> {
  const client = new ResourceGroupsTaggingAPIClient({ region: REGION });
  const arns: string[] = [];
  let paginationToken: string | undefined;
  do {
    const result = await client.send(
      new GetResourcesCommand({
        TagFilters: [{ Key: 'app', Values: [`techtok-${stage}`] }],
        ResourceTypeFilters: ['dynamodb'],
        PaginationToken: paginationToken,
      }),
    );
    for (const mapping of result.ResourceTagMappingList ?? []) {
      if (mapping.ResourceARN) arns.push(mapping.ResourceARN);
    }
    paginationToken = result.PaginationToken || undefined;
  } while (paginationToken);

  const match = arns.find((arn) => arn.includes(logicalNameFragment));
  if (!match) {
    throw new Error(
      `Could not find a DynamoDB table matching "${logicalNameFragment}" tagged app=techtok-${stage}`,
    );
  }
  const name = match.split('/').pop();
  if (!name) throw new Error(`Could not parse a table name out of ARN: ${match}`);
  return name;
}
