import {
  type DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import type { CompactBlock, CompactFigure, ContentJobStage, Language } from '@techtok/shared';

// Job records are ephemeral polling state, not a durable record — short TTL
// keeps the table from accumulating one row per compact-reader tap forever.
const JOB_TTL_SECONDS = 60 * 60;

export type ContentJobOutcome =
  | { readonly available: true; readonly blocks: CompactBlock[]; readonly figures: CompactFigure[] }
  | { readonly available: false; readonly reason: string };

export interface ContentJobRecord {
  readonly jobId: string;
  readonly postId: string;
  readonly lang: Language;
  readonly stage: ContentJobStage;
  readonly available: boolean | null;
  readonly blocks?: CompactBlock[];
  readonly figures?: CompactFigure[];
  readonly reason?: string;
}

export class ContentJobsRepo {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  /** Creates a job at its first real stage (D27) — `available` stays `null`
   * until `complete` is called. */
  async create(jobId: string, postId: string, lang: Language): Promise<void> {
    await this.client.send(
      new PutCommand({
        TableName: this.tableName,
        Item: {
          jobId,
          postId,
          lang,
          stage: 'fetching',
          available: null,
          ttl: Math.floor(Date.now() / 1000) + JOB_TTL_SECONDS,
        },
      }),
    );
  }

  async getById(jobId: string): Promise<ContentJobRecord | undefined> {
    const result = await this.client.send(
      new GetCommand({ TableName: this.tableName, Key: { jobId } }),
    );
    return result.Item as ContentJobRecord | undefined;
  }

  /** Advances a job to a non-terminal stage — attribute names are aliased
   * throughout this class even where not strictly required by DynamoDB's
   * reserved-word list, matching this repo's own hard-won convention
   * (CLAUDE.md). */
  async updateStage(jobId: string, stage: ContentJobStage): Promise<void> {
    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { jobId },
        UpdateExpression: 'SET #stage = :stage',
        ExpressionAttributeNames: { '#stage': 'stage' },
        ExpressionAttributeValues: { ':stage': stage },
      }),
    );
  }

  /** Marks a job `done`, with either the generated content or the reason it
   * couldn't be prepared (D23/D27 degrade convention — never an error). */
  async complete(jobId: string, outcome: ContentJobOutcome): Promise<void> {
    if (outcome.available) {
      await this.client.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { jobId },
          UpdateExpression:
            'SET #stage = :stage, #available = :available, #blocks = :blocks, #figures = :figures',
          ExpressionAttributeNames: {
            '#stage': 'stage',
            '#available': 'available',
            '#blocks': 'blocks',
            '#figures': 'figures',
          },
          ExpressionAttributeValues: {
            ':stage': 'done',
            ':available': true,
            ':blocks': outcome.blocks,
            ':figures': outcome.figures,
          },
        }),
      );
      return;
    }

    await this.client.send(
      new UpdateCommand({
        TableName: this.tableName,
        Key: { jobId },
        UpdateExpression: 'SET #stage = :stage, #available = :available, #reason = :reason',
        ExpressionAttributeNames: {
          '#stage': 'stage',
          '#available': 'available',
          '#reason': 'reason',
        },
        ExpressionAttributeValues: {
          ':stage': 'done',
          ':available': false,
          ':reason': outcome.reason,
        },
      }),
    );
  }
}
