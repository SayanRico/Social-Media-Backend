const mongoose = require("mongoose");
const { Schema } = mongoose;

const featureFlagSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    enabled: { type: Boolean, default: false },
    rolloutPercent: { type: Number, default: 100, min: 0, max: 100 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("feature_flag", featureFlagSchema);
