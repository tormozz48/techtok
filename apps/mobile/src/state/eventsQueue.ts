import { AppState } from 'react-native';
import { postEvents } from '@/api/client';
import { loadQueue, saveQueue } from './logStore';

const FLUSH_INTERVAL_MS = 15000;
const BATCH_SIZE = 50;

let started = false;

export { logError, logEvent } from './logStore';

export async function flushEventsQueue(): Promise<void> {
  const queue = loadQueue();
  if (queue.length === 0) return;

  const batch = queue.slice(0, BATCH_SIZE);
  try {
    await postEvents(batch);
    saveQueue(loadQueue().slice(batch.length));
  } catch {}
}

export function startEventsQueueFlushing(): void {
  if (started) return;
  started = true;

  flushEventsQueue();
  setInterval(flushEventsQueue, FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') flushEventsQueue();
  });
}
