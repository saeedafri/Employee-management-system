// SSE connection registry.
//
// Connections are necessarily per-process (a socket lives on one instance), but
// *delivery* must not be: a notification created on instance A has to reach a
// client connected to instance B. Without that, live push breaks silently the
// moment the backend runs more than one replica — REST keeps working, so the
// failure is easy to miss.
//
// So every emit is published to Redis and delivered by whichever instance holds
// the socket. With Redis unset (local dev, single container) it degrades to
// direct in-process delivery and behaves exactly as before.
import { getRedis, redisEnabled } from '../lib/redis.js';
import { logger } from './logger.js';

const clients = new Map(); // userId → Set<reply>
const CHANNEL = 'ems:sse';

let connects = 0;
let disconnects = 0;
let emits = 0;
let emitFailures = 0;
let published = 0;
let receivedFromRedis = 0;
let subscriber = null;

export function addClient(userId, reply) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(reply);
  connects += 1;
}

export function removeClient(userId, reply) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(reply);
  disconnects += 1;
  if (set.size === 0) clients.delete(userId);
}

function sendEvent(reply, event, data) {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** Deliver to sockets held by THIS process. */
function deliverLocally(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const dead = [];
  for (const reply of set) {
    try {
      sendEvent(reply, event, data);
      emits += 1;
    } catch {
      emitFailures += 1;
      dead.push(reply);
    }
  }
  dead.forEach((r) => set.delete(r));
  if (set.size === 0) clients.delete(userId);
}

/**
 * Subscribe this instance to the cross-instance channel. Called once at boot.
 * Safe to call when Redis is disabled — it simply does nothing.
 */
export async function initSseFanout() {
  if (!redisEnabled || subscriber) return { enabled: false };

  const base = getRedis();
  if (!base) return { enabled: false };

  try {
    // A subscribed connection cannot issue normal commands, so it needs its own.
    subscriber = base.duplicate();
    subscriber.on('error', (err) => logger.error({ err: err.message }, '[sse] subscriber error'));

    subscriber.on('message', (channel, payload) => {
      if (channel !== CHANNEL) return;
      receivedFromRedis += 1;
      try {
        const { userId, event, data } = JSON.parse(payload);
        deliverLocally(userId, event, data);
      } catch (err) {
        logger.error({ err: err.message }, '[sse] malformed fan-out payload');
      }
    });

    await subscriber.subscribe(CHANNEL);
    logger.info({ channel: CHANNEL }, '[sse] cross-instance fan-out enabled');
    return { enabled: true };
  } catch (err) {
    // Never let this stop the server: fall back to single-instance delivery.
    logger.error({ err: err.message }, '[sse] fan-out unavailable, using local delivery');
    subscriber = null;
    return { enabled: false, error: err.message };
  }
}

export function emitToUser(userId, event, data) {
  if (!userId) return;

  // With fan-out on, publish only: every instance (including this one) receives
  // the message back through the subscriber and delivers to its own sockets.
  // Delivering locally *as well* would double-send to this instance's clients.
  if (subscriber) {
    const redis = getRedis();
    if (redis) {
      published += 1;
      redis.publish(CHANNEL, JSON.stringify({ userId, event, data })).catch((err) => {
        // Publish failed — deliver locally so this instance's clients still get it.
        logger.error({ err: err.message }, '[sse] publish failed, delivering locally');
        deliverLocally(userId, event, data);
      });
      return;
    }
  }

  deliverLocally(userId, event, data);
}

export function emitToUsers(userIds, event, data) {
  for (const uid of userIds) {
    if (uid) emitToUser(uid, event, data);
  }
}

export function getSseDiagnostics() {
  let connectionCount = 0;
  for (const set of clients.values()) connectionCount += set.size;
  return {
    uniqueUsers: clients.size,
    connectionCount,
    connects,
    disconnects,
    emits,
    emitFailures,
    fanoutEnabled: Boolean(subscriber),
    published,
    receivedFromRedis,
  };
}

/** Test seam: drop the subscriber so delivery falls back to in-process. */
export async function stopSseFanout() {
  if (!subscriber) return;
  try { await subscriber.quit(); } catch { /* already closed */ }
  subscriber = null;
}
