import { type SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';

export class RawMailSender {
  constructor(private readonly client: SESClient) {}

  async send(source: string, destination: string, message: string): Promise<void> {
    await this.client.send(
      new SendRawEmailCommand({
        Source: source,
        Destinations: [destination],
        RawMessage: { Data: Buffer.from(message, 'latin1') },
      }),
    );
  }
}
