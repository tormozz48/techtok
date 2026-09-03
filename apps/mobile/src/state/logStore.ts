import type { ClientRecord } from '@techtok/shared';
import { Sentry } from './sentry';
import { storage } from './storage';

const QUEUE_KEY = 'techtok.eventsQueue';
const MAX_QUEUED_RECORDS = 200;

export function loadQueue(): ClientRecord[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ClientRecord[];
  } catch {
    return [];
  }
}

export function saveQueue(queue: ClientRecord[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

export function logEvent(name: string, props?: Record<string, unknown>): void {
  enqueue({ kind: 'event', name, props, occurredAt: new Date().toISOString() });
}

export function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as { code?: unknown }).code,
      stack: error.stack,
    };
  }
  return { message: String(error) };
}

export function logError(
  message: string,
  context?: Record<string, unknown>,
  error?: unknown,
): void {
  enqueue({ kind: 'log', level: 'error', message, context, occurredAt: new Date().toISOString() });
  if (error instanceof Error) {
    Sentry.captureException(error, {
      level: 'error',
      tags: { logMessage: message },
      extra: context,
    });
  } else {
    Sentry.captureMessage(message, { level: 'error', extra: context });
  }
}

function enqueue(record: ClientRecord): void {
  const queue = loadQueue();
  queue.push(record);
  saveQueue(
    queue.length > MAX_QUEUED_RECORDS ? queue.slice(queue.length - MAX_QUEUED_RECORDS) : queue,
  );
}
