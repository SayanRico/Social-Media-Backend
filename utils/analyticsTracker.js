const AnalyticsEvent = require("../models/analyticsEventModel");

const trackEvent = async ({ userId, event, metadata, req }) => {
  try {
    await AnalyticsEvent.create({
      userId: userId || null,
      event,
      metadata: metadata || {},
      sessionId: req?.headers?.["x-session-id"] || null,
      ip: req?.ip || req?.headers?.["x-forwarded-for"] || null,
      userAgent: req?.headers?.["user-agent"] || null,
    });
  } catch (err) {
    console.error("[ANALYTICS] track failed:", err.message);
  }
};

module.exports = { trackEvent };
