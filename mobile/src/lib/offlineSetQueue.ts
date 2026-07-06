// RN wiring for the offline set-write queue: AsyncStorage persistence, NetInfo
// reconnect-triggered flushes, and the api-backed sender. Queue semantics live
// in retryQueue.ts (pure, RN-free). SessionLogScreen consumes this via
// useSetWriteQueue().

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

import { api, ApiError, NetworkError } from "./api";
import {
  deserializeQueue,
  enqueueItem,
  flushQueue,
  itemsForSession,
  removeItem,
  serializeQueue,
  type NewQueuedWrite,
  type QueuedWrite,
  type SendOutcome,
} from "./retryQueue";

const STORAGE_KEY = "liftiq.setWriteQueue.v1";

async function send(item: QueuedWrite): Promise<SendOutcome> {
  try {
    if (item.kind === "logSet") {
      await api.sessions.logSet(item.sessionId, item.body as Parameters<typeof api.sessions.logSet>[1]);
    } else {
      await api.sessions.deleteSet(item.setId);
    }
    return "ok";
  } catch (e) {
    if (e instanceof NetworkError) return "retry";
    if (e instanceof ApiError) {
      if (e.status === 401) return "auth";
      if (e.status >= 500) return "retry";
      // Deleting a set that's already gone is success, not a failure to report.
      if (item.kind === "deleteSet" && e.status === 404) return "ok";
      return "drop";
    }
    return "retry";
  }
}

type Listener = () => void;

class OfflineSetQueue {
  private queue: QueuedWrite[] = [];
  private listeners = new Set<Listener>();
  private loaded = false;
  private flushing = false; // single-flight: no double-submission from overlapping triggers
  private counter = 0;

  /** Set when a flush hit a 401 — cleared on the next explicit flush (i.e.
   * after the user signs back in and retries). */
  authBlocked = false;
  /** Count of writes permanently rejected by the server (drained by the UI to
   * show one alert, then reset). */
  droppedSinceLastCheck: QueuedWrite[] = [];

  async load(): Promise<void> {
    if (this.loaded) return;
    this.queue = deserializeQueue(await AsyncStorage.getItem(STORAGE_KEY));
    this.loaded = true;
    this.notify();
  }

  items(sessionId: number): QueuedWrite[] {
    return itemsForSession(this.queue, sessionId);
  }

  size(): number {
    return this.queue.length;
  }

  async enqueue(item: NewQueuedWrite): Promise<QueuedWrite> {
    await this.load();
    const full = {
      ...item,
      id: `w${Date.now()}-${++this.counter}`,
      createdAt: Date.now(),
      attempts: 0,
    } as QueuedWrite;
    this.queue = enqueueItem(this.queue, full);
    await this.persist();
    this.notify();
    return full;
  }

  async remove(id: string): Promise<void> {
    await this.load();
    this.queue = removeItem(this.queue, id);
    await this.persist();
    this.notify();
  }

  async flush(): Promise<{ sentCount: number; remaining: number }> {
    await this.load();
    if (this.flushing || this.queue.length === 0) {
      return { sentCount: 0, remaining: this.queue.length };
    }
    this.flushing = true;
    this.authBlocked = false;
    try {
      const result = await flushQueue(this.queue, send);
      this.queue = result.queue;
      this.authBlocked = result.authBlocked;
      if (result.dropped.length > 0) this.droppedSinceLastCheck.push(...result.dropped);
      await this.persist();
      this.notify();
      return { sentCount: result.sent.length, remaining: this.queue.length };
    } finally {
      this.flushing = false;
    }
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }

  private async persist(): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, serializeQueue(this.queue));
  }
}

export const setWriteQueue = new OfflineSetQueue();

// Flush whenever connectivity comes back. Registered once at module load; the
// queue no-ops when empty so this is cheap.
NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable !== false) {
    void setWriteQueue.flush();
  }
});

/**
 * React binding: pending writes for one session, re-rendering on queue changes.
 * Returns the pending items plus enqueue/remove/flush passthroughs.
 */
export function useSetWriteQueue(sessionId: number) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void setWriteQueue.load();
    return setWriteQueue.subscribe(() => setVersion((v) => v + 1));
  }, []);

  // `version` is only a re-render trigger; items() reads current queue state.
  void version;
  return {
    pending: setWriteQueue.items(sessionId),
    enqueue: setWriteQueue.enqueue.bind(setWriteQueue),
    remove: setWriteQueue.remove.bind(setWriteQueue),
    flush: setWriteQueue.flush.bind(setWriteQueue),
    authBlocked: setWriteQueue.authBlocked,
  };
}
