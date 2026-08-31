import { AppState } from 'react-native';
import { postReads } from '@/api/client';
import { storage } from './storage';

const QUEUE_KEY = 'techtok.readQueue';
const FLUSH_INTERVAL_MS = 5000;

interface QueuedRead {
  postId: string;
  readAt: string;
}

let started = false;

export function enqueueRead(postId: string): void {
  const queue = loadQueue();
  if (queue.some((entry) => entry.postId === postId)) return;
  queue.push({ postId, readAt: new Date().toISOString() });
  saveQueue(queue);
}

export async function flushReadQueue(): Promise<void> {
  const queue = loadQueue();
  if (queue.length === 0) return;

  try {
    await postReads(queue.map((entry) => entry.postId));
    const sentIds = new Set(queue.map((entry) => entry.postId));
    saveQueue(loadQueue().filter((entry) => !sentIds.has(entry.postId)));
  } catch {}
}

export function startReadQueueFlushing(): void {
  if (started) return;
  started = true;

  flushReadQueue();
  setInterval(flushReadQueue, FLUSH_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'background') flushReadQueue();
  });
}

function loadQueue(): QueuedRead[] {
  const raw = storage.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedRead[];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRead[]): void {
  storage.set(QUEUE_KEY, JSON.stringify(queue));
}
