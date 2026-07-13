const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullname: {
      type: String,
      required: true,
      trim: true,
      maxlength: 25,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      maxlength: 25,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    avatar: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460__340.png",
    },
    role: {
      type: String,
      default: "user",
    },
    /** Granular admin role when role === "admin" */
    adminRole: {
      type: String,
      enum: [
        "super_admin",
        "admin",
        "moderator",
        "support",
        "analyst",
        "read_only",
      ],
      default: "admin",
    },
    status: {
      type: String,
      enum: ["active", "banned", "suspended"],
      default: "active",
    },
    /** Bump to invalidate all outstanding JWTs (password change, ban, logout-all). */
    tokenVersion: {
      type: Number,
      default: 0,
    },
    gender: {
      type: String,
      default: "male",
    },
    mobile: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    saved: [
      {
        type: mongoose.Types.ObjectId,
        ref: "post",
      },
    ],
    story: {
      type: String,
      default: "",
      maxlength: 200,
    },
    website: {
      type: String,
      default: "",
    },
    followers: [
      {
        type: mongoose.Types.ObjectId,
        ref: "user",
      },
    ],
    following: [
      {
        type: mongoose.Types.ObjectId,
        ref: "user",
      },
    ],
    strikeCount: { type: Number, default: 0 },
    suspendedUntil: { type: Date, default: null },
    shadowBanned: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    tags: [{ type: String }],
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    loginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },
    totpSecret: { type: String, default: null },
    totpEnabled: { type: Boolean, default: false },
    moderatorNotes: [
      {
        text: String,
        author: { type: mongoose.Types.ObjectId, ref: "user" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    notificationPreferences: {
      push: { type: Boolean, default: true },
      likes: { type: Boolean, default: true },
      comments: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      mentions: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      emailDigest: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ username: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model("user", userSchema);
