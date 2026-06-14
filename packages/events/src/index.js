// Event-name constants — the contract between publishers and consumers.
export const EVENTS = {
  USER_REGISTERED: 'user.registered',
  USER_DELETED: 'user.deleted',
  PROFILE_UPDATED: 'profile.updated',
  CONNECTION_REQUESTED: 'connection.requested',
  CONNECTION_ACCEPTED: 'connection.accepted',
  MESSAGE_SENT: 'message.sent',
  POST_CREATED: 'post.created',
  POST_LIKED: 'post.liked',
  POST_COMMENTED: 'post.commented',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  CALL_INITIATED: 'call.initiated',
  JOB_POSTED: 'job.posted',
};

// Minimal pub/sub over Redis. Swap for SNS+SQS in production (see plan §4.1).
export const createEventBus = (redis) => ({
  async publish(event, payload) {
    if (!redis) return;
    await redis.publish(event, JSON.stringify({ event, payload, ts: Date.now() }));
  },
  subscribe(event, handler) {
    if (!redis) return;
    const sub = redis.duplicate();
    sub.subscribe(event);
    sub.on('message', (_ch, raw) => handler(JSON.parse(raw)));
    return sub;
  },
});
