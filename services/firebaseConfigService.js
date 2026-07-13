const FirebaseConfig = require("../models/firebaseConfigModel");

const CONFIG_KEY = "default";

let cache = null;
let cacheAt = 0;
const CACHE_MS = 30_000;

const toWebConfig = (doc) => ({
  apiKey: doc.apiKey || "",
  authDomain: doc.authDomain || "",
  projectId: doc.projectId || "",
  storageBucket: doc.storageBucket || "",
  messagingSenderId: doc.messagingSenderId || "",
  appId: doc.appId || "",
  measurementId: doc.measurementId || "",
});

const invalidateCache = () => {
  cache = null;
  cacheAt = 0;
};

const loadDocument = async (force = false) => {
  const now = Date.now();
  if (!force && cache && now - cacheAt < CACHE_MS) {
    return cache;
  }

  let doc = await FirebaseConfig.findOne({ key: CONFIG_KEY });
  if (!doc) {
    doc = await FirebaseConfig.create({ key: CONFIG_KEY, enabled: false });
  }

  cache = doc;
  cacheAt = now;
  return doc;
};

const getPublicConfig = async () => {
  const doc = await loadDocument();
  return {
    enabled: Boolean(doc.enabled),
    vapidKey: doc.vapidKey || "",
    webConfig: toWebConfig(doc),
  };
};

const getAdminConfig = async () => {
  const doc = await loadDocument();
  return {
    enabled: Boolean(doc.enabled),
    apiKey: doc.apiKey || "",
    authDomain: doc.authDomain || "",
    projectId: doc.projectId || "",
    storageBucket: doc.storageBucket || "",
    messagingSenderId: doc.messagingSenderId || "",
    appId: doc.appId || "",
    measurementId: doc.measurementId || "",
    vapidKey: doc.vapidKey || "",
    clientEmail: doc.clientEmail || "",
    hasPrivateKey: Boolean(doc.privateKey),
    updatedAt: doc.updatedAt,
  };
};

const getServerCredentials = async () => {
  const doc = await loadDocument();
  if (!doc.enabled) return null;
  if (!doc.projectId || !doc.clientEmail || !doc.privateKey) return null;

  return {
    projectId: doc.projectId,
    clientEmail: doc.clientEmail,
    privateKey: doc.privateKey.replace(/\\n/g, "\n"),
  };
};

const upsertConfig = async (payload = {}, userId) => {
  const current = await loadDocument(true);
  const update = {
    enabled: payload.enabled !== undefined ? Boolean(payload.enabled) : current.enabled,
    apiKey: payload.apiKey ?? current.apiKey,
    authDomain: payload.authDomain ?? current.authDomain,
    projectId: payload.projectId ?? current.projectId,
    storageBucket: payload.storageBucket ?? current.storageBucket,
    messagingSenderId: payload.messagingSenderId ?? current.messagingSenderId,
    appId: payload.appId ?? current.appId,
    measurementId: payload.measurementId ?? current.measurementId,
    vapidKey: payload.vapidKey ?? current.vapidKey,
    clientEmail: payload.clientEmail ?? current.clientEmail,
    updatedBy: userId || null,
  };

  if (payload.privateKey && String(payload.privateKey).trim()) {
    update.privateKey = String(payload.privateKey).trim();
  }

  const doc = await FirebaseConfig.findOneAndUpdate(
    { key: CONFIG_KEY },
    update,
    { upsert: true, new: true }
  );

  invalidateCache();
  return doc;
};

module.exports = {
  getPublicConfig,
  getAdminConfig,
  getServerCredentials,
  upsertConfig,
  invalidateCache,
  toWebConfig,
};
