import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

// Write model for the shared `notifications` collection (shared-DB phase).
// post-service creates post_like / post_comment notifications here;
// notification-service (M2) reads them. The realtime socket emit moves to the
// realtime-gateway in M5 — see docs/migration §7.
const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: ObjectId, ref: 'User', required: true },
    actorId: { type: ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['post_like', 'post_comment', 'job_application', 'job_application_status'],
        message: '{VALUE} is not a valid notification type',
      },
    },
    postId: { type: ObjectId, ref: 'Post', default: null },
    jobId: { type: ObjectId, ref: 'JobPosting', default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

export default mongoose.model('Notification', notificationSchema);
