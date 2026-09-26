import { z } from 'zod';
import {
  createServiceAccountTokenProvider,
  parseServiceAccountKey,
} from '../billing/googleAccessToken';

const CLOUD_IDENTITY_GROUPS_SCOPE = 'https://www.googleapis.com/auth/cloud-identity.groups';

const CLOUD_IDENTITY_BASE_URL = 'https://cloudidentity.googleapis.com/v1';

const REQUEST_TIMEOUT_MS = 8_000;

const ALREADY_EXISTS_STATUS = 409;

const groupLookupSchema = z.object({ name: z.string().min(1) });

export type AddMemberOutcome = 'added' | 'already_member';

export interface TesterGroupClient {
  addMember(email: string): Promise<AddMemberOutcome>;
}

export function createTesterGroupClient(
  serviceAccountKeyJson: string,
  groupEmail: string,
): TesterGroupClient {
  const tokenProvider = createServiceAccountTokenProvider(
    parseServiceAccountKey(serviceAccountKeyJson),
    CLOUD_IDENTITY_GROUPS_SCOPE,
  );
  let groupName: string | undefined;

  return {
    async addMember(email: string): Promise<AddMemberOutcome> {
      const accessToken = await tokenProvider.getAccessToken();
      groupName ??= await lookupGroupName(accessToken, groupEmail);

      const response = await fetch(`${CLOUD_IDENTITY_BASE_URL}/${groupName}/memberships`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ preferredMemberKey: { id: email }, roles: [{ name: 'MEMBER' }] }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.status === ALREADY_EXISTS_STATUS) return 'already_member';
      if (!response.ok) {
        throw new Error(
          `Cloud Identity membership create failed with status ${response.status}: ${await response.text()}`,
        );
      }
      return 'added';
    },
  };
}

async function lookupGroupName(accessToken: string, groupEmail: string): Promise<string> {
  const query = new URLSearchParams({ 'groupKey.id': groupEmail });
  const response = await fetch(`${CLOUD_IDENTITY_BASE_URL}/groups:lookup?${query}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(
      `Cloud Identity group lookup failed with status ${response.status}: ${await response.text()}`,
    );
  }
  const parsed = groupLookupSchema.safeParse(await response.json());
  if (!parsed.success) throw new Error('Cloud Identity group lookup returned no group name');
  return parsed.data.name;
}
