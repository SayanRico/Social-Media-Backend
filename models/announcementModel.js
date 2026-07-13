const mongoose = require("mongoose");
const { Schema } = mongoose;

const announcementSchema = new Schema(
  {
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    type: {
      type: String,
      enum: ["info", "warning", "maintenance", "feature"],
      default: "info",
    },
    active: { type: Boolean, default: true },
    startsAt: { type: Date, default: Date.now },
    endsAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "user", required: true },
  },
  { timestamps: true }
);

announcementSchema.index({ active: 1, startsAt: -1 });

module.exports = mongoose.model("announcement", announcementSchema);
