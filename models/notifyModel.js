const mongoose = require("mongoose");
const { Schema } = mongoose;

const notifySchema = new Schema(
  {
    id: mongoose.Types.ObjectId,
    user: { type: mongoose.Types.ObjectId, ref: "user" },
    recipients: [mongoose.Types.ObjectId],
    url: String,
    text: String,
    title: String,
    content: String,
    image: String,
    moduleKey: { type: String, default: "social" },
    eventKey: String,
    entityType: String,
    entityId: String,
    channel: { type: String, default: "in_app" },
    payload: { type: Schema.Types.Mixed, default: {} },
    isRead: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

notifySchema.index({ recipients: 1, createdAt: -1 });

module.exports = mongoose.model("notify", notifySchema);
