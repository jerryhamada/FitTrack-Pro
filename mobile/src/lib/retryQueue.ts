// Pure offline retry-queue logic for set writes made mid-workout.
//
// This module deliberately imports nothing from React Native so the queue
// semantics (FIFO ordering, dedup, single-flight flush, drop-vs-retry rules)
// are unit-testable in plain Node if/when a JS test runner is added. The RN
// wiring (AsyncStorage persistence, NetInfo triggers, the api sender) lives in
// offlineSetQueue.ts; the UI exercises it via SessionLogScreen.
//
// Known limitation, accepted for now: there is no server-side idempotency key,
// so if the app is killed after the server accepts a write but before we
// dequeue it, the next flush re-sends it (duplicate set). The trainer can
// delete the dupe; fixing it properly needs a client_request_id column.

export interface QueuedLogSet {
  kind: "logSet";
  body: Record<string, unknown> & { exercise_id: number };
}

export interface QueuedDeleteSet {
  kind: "deleteSet";
  setId: number;
}

export type QueuedWrite = (QueuedLogSet | QueuedDeleteSet) & {
  id: string; // unique per enqueue — dedup key
  sessionId: number;
  createdAt: number;
  attempts: number;
};

/** Enqueue input: the write itself plus its session — id/timestamps are added
 * by the queue. Kept as a distributed union so the logSet/deleteSet payloads
 * stay discriminated (Omit<QueuedWrite, ...> would collapse them). */
export type NewQueuedWrite = (QueuedLogSet | QueuedDeleteSet) & { sessionId: number };

/** What the sender reports back for one item during a flush. */
export type SendOutcome =
  | "ok" // server accepted — remove from queue
  | "retry" // network still down / transient — keep, stop the flush (preserves FIFO)
  | "auth" // 401 — keep the item, pause flushing until re-login
  | "drop"; // server rejected it for real (4xx) — remove, surface to the user

export type Sender = (item: QueuedWrite) => Promise<SendOutcome>;

/** Give up on an item after this many failed attempts so one poison-pill write
 * can't block the queue forever (each attempt only happens on a reconnect or an
 * explicit flush, so this is not a tight loop). */
export const MAX_ATTEMPTS = 10;

export function enqueueItem(queue: QueuedWrite[], item: QueuedWrite): QueuedWrite[] {
  if (queue.some((q) => q.id === item.id)) return queue; // dedup
  return [...queue, item];
}

export function removeItem(queue: QueuedWrite[], id: string): QueuedWrite[] {
  return queue.filter((q) => q.id !== id);
}

export function itemsForSession(queue: QueuedWrite[], sessionId: number): QueuedWrite[] {
  return queue.filter((q) => q.sessionId === sessionId);
}

export interface FlushResult {
  queue: QueuedWrite[];
  sent: QueuedWrite[]; // accepted by the server this flush
  dropped: QueuedWrite[]; // permanently rejected (or gave up after MAX_ATTEMPTS)
  authBlocked: boolean; // hit a 401 — caller should surface re-login
}

/**
 * Try to send every queued item, strictly in FIFO order. Stops at the first
 * "retry" outcome so a set logged while offline can never land after a later
 * write (ordering matters: deleteSet must not overtake the logSet it targets).
 */
export async function flushQueue(queue: QueuedWrite[], send: Sender): Promise<FlushResult> {
  let current = [...queue];
  const sent: QueuedWrite[] = [];
  const dropped: QueuedWrite[] = [];

  for (const item of [...current]) {
    let outcome: SendOutcome;
    try {
      outcome = await send(item);
    } catch {
      outcome = "retry"; // a sender bug must never lose queued sets
    }

    if (outcome === "ok") {
      current = removeItem(current, item.id);
      sent.push(item);
      continue;
    }
    if (outcome === "drop") {
      current = removeItem(current, item.id);
      dropped.push(item);
      continue;
    }
    if (outcome === "auth") {
      return { queue: current, sent, dropped, authBlocked: true };
    }
    // retry
    const attempts = item.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      current = removeItem(current, item.id);
      dropped.push(item);
      continue;
    }
    current = current.map((q) => (q.id === item.id ? { ...q, attempts } : q));
    break; // still offline — keep FIFO order, try again on next trigger
  }

  return { queue: current, sent, dropped, authBlocked: false };
}

export function serializeQueue(queue: QueuedWrite[]): string {
  return JSON.stringify(queue);
}

export function deserializeQueue(raw: string | null): QueuedWrite[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Only keep entries that still look like queued writes — a corrupted store
    // should degrade to an empty queue, never crash set logging.
    return parsed.filter(
      (q): q is QueuedWrite =>
        q != null &&
        typeof q.id === "string" &&
        typeof q.sessionId === "number" &&
        (q.kind === "logSet" || q.kind === "deleteSet")
    );
  } catch {
    return [];
  }
}
