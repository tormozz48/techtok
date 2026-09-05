import { SESClient } from '@aws-sdk/client-ses';

export function createSesClient(): SESClient {
  return new SESClient({});
}
