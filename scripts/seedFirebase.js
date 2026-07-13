/**
 * Seed default Firebase configuration into MongoDB.
 * Run: npm run seed:firebase
 *
 * Override values via env at seed time only (not used at runtime):
 *   SEED_FIREBASE_API_KEY, SEED_FIREBASE_VAPID_KEY, etc.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const FirebaseConfig = require("../models/firebaseConfigModel");

const defaults = {
  key: "default",
  enabled: true,
  apiKey: process.env.SEED_FIREBASE_API_KEY || "AIzaSyCWQlNxnBVRNg5je-6hKaY18ddL0hppEBI",
  authDomain: process.env.SEED_FIREBASE_AUTH_DOMAIN || "facemeet-b5911.firebaseapp.com",
  projectId: process.env.SEED_FIREBASE_PROJECT_ID || "facemeet-b5911",
  storageBucket:
    process.env.SEED_FIREBASE_STORAGE_BUCKET || "facemeet-b5911.firebasestorage.app",
  messagingSenderId: process.env.SEED_FIREBASE_MESSAGING_SENDER_ID || "405233580959",
  appId:
    process.env.SEED_FIREBASE_APP_ID || "1:405233580959:web:22a3ed0ecc627e605edbaa",
  measurementId: process.env.SEED_FIREBASE_MEASUREMENT_ID || "G-FVTQL0PV90",
  vapidKey:
    process.env.SEED_FIREBASE_VAPID_KEY ||
    "BBf5S8dn5uMBbnEo4HYPRZOMoybbBnRRY_VlRkwUCbNDy89PK3VKFQhCGKWbLnE5h5y77WMLje8PW00NQXO9dPw",
  clientEmail: process.env.SEED_FIREBASE_CLIENT_EMAIL || "",
  privateKey: process.env.SEED_FIREBASE_PRIVATE_KEY || "",
};

const run = async () => {
  const uri = process.env.MONGODB_URL;
  if (!uri) throw new Error("MONGODB_URL is required");

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  });

  const existing = await FirebaseConfig.findOne({ key: "default" });
  const update = { ...defaults };

  if (existing?.privateKey && !update.privateKey) {
    delete update.privateKey;
  }

  const doc = await FirebaseConfig.findOneAndUpdate(
    { key: "default" },
    update,
    { upsert: true, new: true }
  );

  console.log("Firebase config seeded:", {
    enabled: doc.enabled,
    projectId: doc.projectId,
    hasPrivateKey: Boolean(doc.privateKey),
    hasVapidKey: Boolean(doc.vapidKey),
  });

  await mongoose.connection.close();
};

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
