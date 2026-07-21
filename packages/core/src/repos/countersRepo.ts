import { type DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { conditionalWrite } from './dynamoClient';

export class CountersRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /**
   * Atomically increments today's transform counter and reports whether the
   * increment landed at or under `cap`. The conditional expression makes
   * concurrent Lambda invocations race safely — only as many callers as the
   * cap allows ever see `true`, regardless of batch concurrency.
   */
  async incrementIfUnderCap(date: string, cap: number): Promise<boolean> {
    const counterId = `transforms#${date}`;
    return conditionalWrite(() =>
      this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { counterId },
          // #count: COUNT is a reserved word in DynamoDB's expression
          // grammar (see the status/transform incident this project
          // already hit once — CLAUDE.md) and fails unaliased.
          UpdateExpression: 'ADD #count :one',
          ConditionExpression: 'attribute_not_exists(#count) OR #count < :cap',
          ExpressionAttributeNames: { '#count': 'count' },
          ExpressionAttributeValues: { ':one': 1, ':cap': cap },
        }),
      ),
    );
  }
}
