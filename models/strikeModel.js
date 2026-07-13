const mongoose = require("mongoose");
const { Schema } = mongoose;

const strikeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", required: true },
    report: { type: Schema.Types.ObjectId, ref: "report", default: null },
    reason: { type: String, required: true },
    action: {
      type: String,
      enum: ["warning", "suspend", "shadow_ban", "ban", "content_remove"],
      required: true,
    },
    durationHours: { type: Number, default: 0 },
    issuedBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
    note: { type: String, default: "" },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

strikeSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("strike", strikeSchema);
