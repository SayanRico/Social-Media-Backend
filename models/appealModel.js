const mongoose = require("mongoose");
const { Schema } = mongoose;

const appealSchema = new Schema(
  {
    report: { type: Schema.Types.ObjectId, ref: "report", required: true },
    user: { type: Schema.Types.ObjectId, ref: "user", required: true },
    reason: { type: String, required: true, maxlength: 2000 },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);

appealSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("appeal", appealSchema);
