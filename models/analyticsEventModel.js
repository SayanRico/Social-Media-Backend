const mongoose = require("mongoose");
const { Schema } = mongoose;

const analyticsEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", default: null },
    event: { type: String, required: true },
    metadata: Schema.Types.Mixed,
    sessionId: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: true }
);

analyticsEventSchema.index({ event: 1, createdAt: -1 });
analyticsEventSchema.index({ userId: 1, createdAt: -1 });
analyticsEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model("analytics_event", analyticsEventSchema);
