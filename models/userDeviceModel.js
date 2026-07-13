const mongoose = require("mongoose");
const { Schema } = mongoose;

const userDeviceSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", required: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, default: "web" },
    userAgent: String,
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userDeviceSchema.index({ user: 1, isActive: 1 });

module.exports = mongoose.model("userDevice", userDeviceSchema);
