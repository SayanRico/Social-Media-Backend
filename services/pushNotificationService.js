const UserDevice = require("../models/userDeviceModel");
const { getMessaging } = require("../config/firebaseAdmin");

const INVALID_TOKEN_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

const stringifyData = (data = {}) => {
  const out = {};
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      out[key] = String(value);
    }
  });
  return out;
};

const deactivateTokens = async (tokens = []) => {
  if (!tokens.length) return;
  await UserDevice.updateMany(
    { token: { $in: tokens } },
    { isActive: false }
  );
};

const sendToUsers = async (userIds = [], payload = {}) => {
  const messaging = await getMessaging();
  if (!messaging) {
    return {
      skipped: true,
      reason: "firebase_not_configured",
      successCount: 0,
      failureCount: 0,
    };
  }

  const uniqueUserIds = [...new Set(userIds.map((id) => String(id)))];
  const devices = await UserDevice.find({
    user: { $in: uniqueUserIds },
    isActive: true,
  }).select("token user");

  if (!devices.length) {
    return {
      devicesFound: false,
      successCount: 0,
      failureCount: 0,
      skipped: 0,
    };
  }

  const tokens = devices.map((d) => d.token);
  const { title, body, image, data = {} } = payload;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title: title || "Face Meet",
      body: body || "",
      ...(image ? { imageUrl: image } : {}),
    },
    data: stringifyData(data),
    webpush: {
      fcmOptions: {
        link: data.url
          ? `${process.env.FRONTEND_URL || "http://localhost:3000"}${data.url}`
          : undefined,
      },
    },
  });

  const invalidTokens = [];
  response.responses.forEach((item, index) => {
    if (!item.success && INVALID_TOKEN_CODES.has(item.error?.code)) {
      invalidTokens.push(tokens[index]);
    }
  });
  await deactivateTokens(invalidTokens);

  return {
    devicesFound: true,
    successCount: response.successCount,
    failureCount: response.failureCount,
    invalidTokens: invalidTokens.length,
  };
};

module.exports = {
  sendToUsers,
  deactivateTokens,
};
