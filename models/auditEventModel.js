const mongoose = require("mongoose");
const { Schema } = mongoose;

const auditEventSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    actorRole: String,
    actorIp: String,
    action: { type: String, required: true },
    resourceType: String,
    resourceId: Schema.Types.ObjectId,
    beforeState: Schema.Types.Mixed,
    afterState: Schema.Types.Mixed,
    metadata: Schema.Types.Mixed,
    correlationId: String,
  },
  { timestamps: true }
);

auditEventSchema.index({ createdAt: -1 });
auditEventSchema.index({ actorId: 1, createdAt: -1 });
auditEventSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model("audit_event", auditEventSchema);
