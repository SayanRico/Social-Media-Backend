const mongoose = require("mongoose");
const { Schema } = mongoose;

const REASONS = [
  "spam",
  "harassment",
  "hate",
  "violence",
  "nsfw",
  "fake_account",
  "copyright",
  "fraud",
  "self_harm",
  "other",
];

const PRIORITY_MAP = {
  violence: "P0",
  self_harm: "P0",
  fraud: "P0",
  harassment: "P1",
  hate: "P1",
  nsfw: "P1",
  fake_account: "P1",
  spam: "P2",
  copyright: "P2",
  other: "P2",
};

const reportSchema = new Schema(
  {
    entityType: {
      type: String,
      enum: ["post", "comment", "user", "message", "media", "profile"],
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REASONS, required: true },
    description: { type: String, default: "", maxlength: 2000 },
    priority: { type: String, enum: ["P0", "P1", "P2"], default: "P2" },
    status: {
      type: String,
      enum: [
        "submitted",
        "triaged",
        "under_review",
        "action_taken",
        "dismissed",
        "appealed",
        "closed",
      ],
      default: "submitted",
    },
    reporter: { type: Schema.Types.ObjectId, ref: "user", required: true },
    assignee: { type: Schema.Types.ObjectId, ref: "user", default: null },
    evidence: [String],
    resolution: { type: String, default: "" },
    actionTaken: { type: String, default: "" },
    targetUser: { type: Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

reportSchema.pre("save", function setPriority(next) {
  if (this.isNew && this.reason) {
    this.priority = PRIORITY_MAP[this.reason] || "P2";
  }
  next();
});

reportSchema.index({ status: 1, priority: 1, createdAt: -1 });
reportSchema.index({ entityType: 1, entityId: 1 });
reportSchema.index({ reporter: 1, entityId: 1 });

module.exports = mongoose.model("report", reportSchema);
module.exports.REPORT_REASONS = REASONS;
