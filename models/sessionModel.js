const mongoose = require("mongoose");
const { Schema } = mongoose;

const sessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", required: true },
    refreshFamily: { type: String, required: true },
    ip: String,
    userAgent: String,
    lastActive: { type: Date, default: Date.now },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sessionSchema.index({ user: 1, revoked: 1 });
sessionSchema.index({ refreshFamily: 1 });

module.exports = mongoose.model("session", sessionSchema);
