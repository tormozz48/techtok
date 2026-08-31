import { ApiGatewayV2Client, GetApiCommand } from '@aws-sdk/client-apigatewayv2';
import {
  GetResourcesCommand,
  ResourceGroupsTaggingAPIClient,
} from '@aws-sdk/client-resource-groups-tagging-api';

export const REGION = 'eu-central-1';

export interface DevResources {
  ingestPipelineArn: string;
  transformQueueUrl: string;
  translateQueueUrl: string;
  contentQueueUrl: string;
  postsTableName: string;
  sourcesTableName: string;
  apiId: string;
}

export async function discoverDevResources(stage = 'dev'): Promise<DevResources> {
  const arns = await listTaggedArns(stage);

  const ingestPipelineArn = findArn(
    arns,
    (arn) =>
      arn.startsWith('arn:aws:states:') &&
      arn.includes(':stateMachine:') &&
      arn.includes('IngestPipeline'),
    'IngestPipeline state machine',
  );
  const transformQueueArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:sqs:') && arn.includes('TransformQueueQueue'),
    'TransformQueue',
  );
  const translateQueueArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:sqs:') && arn.includes('TranslateQueueQueue'),
    'TranslateQueue',
  );
  const contentQueueArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:sqs:') && arn.includes('ContentQueueQueue'),
    'ContentQueue',
  );
  const postsTableArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:dynamodb:') && arn.includes('PostsTable'),
    'Posts table',
  );
  const sourcesTableArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:dynamodb:') && arn.includes('SourcesTable'),
    'Sources table',
  );
  const apiArn = findArn(
    arns,
    (arn) => arn.startsWith('arn:aws:apigateway:') && /\/apis\/[^/]+$/.test(arn),
    'HTTP API',
  );
  const apiId = apiArn.split('/').pop();
  if (!apiId) throw new Error(`Could not parse an API id out of ARN: ${apiArn}`);

  return {
    ingestPipelineArn,
    transformQueueUrl: queueUrlFromArn(transformQueueArn),
    translateQueueUrl: queueUrlFromArn(translateQueueArn),
    contentQueueUrl: queueUrlFromArn(contentQueueArn),
    postsTableName: dynamoTableNameFromArn(postsTableArn),
    sourcesTableName: dynamoTableNameFromArn(sourcesTableArn),
    apiId,
  };
}

export async function getApiEndpoint(apiId: string): Promise<string> {
  const client = new ApiGatewayV2Client({ region: REGION });
  const result = await client.send(new GetApiCommand({ ApiId: apiId }));
  if (!result.ApiEndpoint) throw new Error(`API ${apiId} has no ApiEndpoint`);
  return result.ApiEndpoint;
}

function queueUrlFromArn(arn: string): string {
  const [, , , region, account, name] = arn.split(':');
  return `https://sqs.${region}.amazonaws.com/${account}/${name}`;
}

function dynamoTableNameFromArn(arn: string): string {
  const name = arn.split('/').pop();
  if (!name) throw new Error(`Could not parse a table name out of ARN: ${arn}`);
  return name;
}

async function listTaggedArns(stage: string): Promise<string[]> {
  const client = new ResourceGroupsTaggingAPIClient({ region: REGION });
  const arns: string[] = [];
  let paginationToken: string | undefined;
  do {
    const result = await client.send(
      new GetResourcesCommand({
        TagFilters: [{ Key: 'app', Values: [`techtok-${stage}`] }],
        PaginationToken: paginationToken,
      }),
    );
    for (const mapping of result.ResourceTagMappingList ?? []) {
      if (mapping.ResourceARN) arns.push(mapping.ResourceARN);
    }
    paginationToken = result.PaginationToken || undefined;
  } while (paginationToken);
  return arns;
}

function findArn(arns: string[], predicate: (arn: string) => boolean, label: string): string {
  const match = arns.find(predicate);
  if (!match)
    throw new Error(`Could not discover the ${label} among the tagged dev-stage resources`);
  return match;
}
