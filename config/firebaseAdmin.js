const admin = require("firebase-admin");
const firebaseConfigService = require("../services/firebaseConfigService");

let ready = false;
let initPromise = null;

const resetFirebaseAdmin = () => {
  ready = false;
  initPromise = null;
  if (admin.apps.length) {
    return admin.app().delete().catch(() => {});
  }
  return Promise.resolve();
};

const initFirebaseAdmin = async () => {
  if (ready) return true;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const credentials = await firebaseConfigService.getServerCredentials();
    if (!credentials) {
      console.warn(
        "[FCM] Firebase push disabled — configure credentials in Admin → Firebase Settings (database)."
      );
      return false;
    }

    try {
      if (admin.apps.length) {
        await admin.app().delete();
      }

      admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });

      ready = true;
      console.log("[FCM] Firebase Admin initialized from database config");
      return true;
    } catch (err) {
      console.error("[FCM] Firebase Admin init failed:", err.message);
      ready = false;
      return false;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

const isReady = async () => {
  if (ready) return true;
  return initFirebaseAdmin();
};

const getMessaging = async () => {
  const ok = await isReady();
  if (!ok) return null;
  return admin.messaging();
};

module.exports = {
  initFirebaseAdmin,
  resetFirebaseAdmin,
  isReady,
  getMessaging,
  admin,
};
