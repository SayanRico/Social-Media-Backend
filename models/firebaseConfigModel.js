const mongoose = require("mongoose");
const { Schema } = mongoose;

const firebaseConfigSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    enabled: { type: Boolean, default: false },
    apiKey: { type: String, default: "" },
    authDomain: { type: String, default: "" },
    projectId: { type: String, default: "" },
    storageBucket: { type: String, default: "" },
    messagingSenderId: { type: String, default: "" },
    appId: { type: String, default: "" },
    measurementId: { type: String, default: "" },
    vapidKey: { type: String, default: "" },
    clientEmail: { type: String, default: "" },
    privateKey: { type: String, default: "" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "user", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("firebase_config", firebaseConfigSchema);
