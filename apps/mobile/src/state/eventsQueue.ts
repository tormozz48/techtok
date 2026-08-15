import type { ClientRecord } from '@techtok/shared';
import { AppState } from 'react-native';
import { postEvents } from '@/api/client';
import { storage } from './storage';

const QUEUE_KEY = 'techtok.eventsQueue';
const FLUSH_INTERVAL_MS = 15000;
const BATCH_SIZE = 50;
// Bounds MMKV growth if the network is down for a long stretch — oldest
// records are dropped first rather than letting the queue grow unbounded.
const MAX_QUEUED_RECORDS = 200;

function loadQueue(): ClientRecord[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ClientRecord[];
  } catch {
    return [];
  }
}

function saveQueue(queue: ClientRecord[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}

function enqueue(record: ClientRecord): void {
  const queue = loadQueue();
  queue.push(record);
  saveQueue(
    queue.length > MAX_QUEUED_RECORDS ? queue.slice(queue.length - MAX_QUEUED_RECORDS) : queue,
  );
}

/** Product-analytics event — screen views, swipe/read events, feature usage. */
export function logEvent(name: string, props?: Record<string, unknown>): void {
  enqueue({ kind: 'event', name, props, occurredAt: new Date().toISOString() });
}

/** Non-crash client log. Crash reporting is a separate, still-deferred
 * decision (DESIGN §12) and does not go through this queue. */
export function logError(message: string, context?: Record<string, unknown>): void {
  enqueue({ kind: 'log', level: 'error', message, context, occurredAt: new Date().toISOString() });
}

export async function flushEventsQueue(): Promise<void> {
  const queue = loadQueue();
  if (queue.length === 0) return;

  const batch = queue.slice(0, BATCH_SIZE);
  try {
    await postEvents(batch);
    saveQueue(loadQueue().slice(batch.length));
  } catch {
    // Network hiccup — leave the queue in place, the next timer tick retries.
  }
}

let started = false;

export function startEventsQueueFlushing(): void {
  if (started) return;
  started = true;

  flushEventsQueue();
  setInterval(flushEventsQueue, FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') flushEventsQueue();
  });
}
