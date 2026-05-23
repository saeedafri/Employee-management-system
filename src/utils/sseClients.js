// In-memory SSE connection registry. Lost on server restart — clients auto-reconnect.
const clients = new Map(); // userId → Set<reply>

export function addClient(userId, reply) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(reply);
}

export function removeClient(userId, reply) {
  const set = clients.get(userId);
  if (!set) return;
  set.delete(reply);
  if (set.size === 0) clients.delete(userId);
}

function sendEvent(reply, event, data) {
  try {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch {
    // Connection dropped — caller handles cleanup
  }
}

export function emitToUser(userId, event, data) {
  const set = clients.get(userId);
  if (!set) return;
  const dead = [];
  for (const reply of set) {
    try {
      sendEvent(reply, event, data);
    } catch {
      dead.push(reply);
    }
  }
  dead.forEach((r) => set.delete(r));
  if (set.size === 0) clients.delete(userId);
}

export function emitToUsers(userIds, event, data) {
  for (const uid of userIds) {
    if (uid) emitToUser(uid, event, data);
  }
}
