const mongoose = require("mongoose");
const Notifies = require("../models/notifyModel");
const Users = require("../models/userModel");
const { getEventConfig } = require("../config/notificationCatalog");
const { renderTemplate } = require("../utils/templateRender");
const {
  emitNotifyToRecipients,
  emitRemoveNotify,
} = require("../utils/socketEmitter");
const pushNotificationService = require("./pushNotificationService");

const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const uniqueIds = (ids = []) =>
  [...new Set(ids.map((id) => idOf(id)).filter(Boolean))];

const buildVariables = ({
  moduleKey,
  eventKey,
  entityType,
  entityId,
  actorUser,
  context = {},
}) => ({
  moduleKey,
  eventKey,
  entityType: entityType || "",
  entityId: entityId ? String(entityId) : "",
  actorUserId: actorUser?._id ? String(actorUser._id) : "",
  actorName: actorUser?.username || actorUser?.fullname || "Someone",
  ...context,
});

const isPreferenceEnabled = (prefs, preferenceKey) => {
  if (!preferenceKey) return true;
  if (!prefs || typeof prefs !== "object") return true;
  if (!Object.prototype.hasOwnProperty.call(prefs, preferenceKey)) return true;
  return Boolean(prefs[preferenceKey]);
};

const isPushEnabled = (prefs) => {
  if (!prefs || typeof prefs !== "object") return true;
  if (!Object.prototype.hasOwnProperty.call(prefs, "push")) return true;
  return Boolean(prefs.push);
};

const filterRecipientsByPreferences = async (
  recipientIds,
  preferenceKey,
  { forPush = false } = {}
) => {
  if (!recipientIds.length) return recipientIds;

  const users = await Users.find({ _id: { $in: recipientIds } }).select(
    "notificationPreferences"
  );

  const allowed = new Set();
  users.forEach((user) => {
    const eventOk = isPreferenceEnabled(
      user.notificationPreferences,
      preferenceKey
    );
    const pushOk = !forPush || isPushEnabled(user.notificationPreferences);
    if (eventOk && pushOk) {
      allowed.add(String(user._id));
    }
  });

  return recipientIds.filter((id) => allowed.has(String(id)));
};

const dispatchSocialEvent = async ({
  eventKey,
  actorUser,
  recipientIds = [],
  entityType,
  entityId,
  context = {},
}) => {
  const moduleKey = "social";
  const config = getEventConfig(moduleKey, eventKey);
  if (!config || !config.rule.is_active || !config.rule.in_app_enabled) {
    return { success: false, reason: "disabled" };
  }

  let recipients = uniqueIds(recipientIds);
  if (config.rule.exclude_actor && actorUser?._id) {
    const actorId = String(actorUser._id);
    recipients = recipients.filter((id) => id !== actorId);
  }

  if (!recipients.length) {
    return { success: false, reason: "no_recipients" };
  }

  recipients = await filterRecipientsByPreferences(
    recipients,
    config.preference_key
  );

  if (!recipients.length) {
    return { success: false, reason: "preferences_filtered" };
  }

  const variables = buildVariables({
    moduleKey,
    eventKey,
    entityType,
    entityId,
    actorUser,
    context,
  });

  const title = renderTemplate(config.template.title_template, variables);
  const text = renderTemplate(config.template.body_template, variables);
  const url = renderTemplate(config.template.action_url_template, variables);

  let notifyId;
  if (eventKey === "like" || eventKey === "follow") {
    notifyId = actorUser._id;
  } else if (context.commentId) {
    notifyId = context.commentId;
  } else if (entityId) {
    notifyId = entityId;
  } else {
    notifyId = new mongoose.Types.ObjectId();
  }

  const notify = new Notifies({
    id: notifyId,
    user: actorUser._id,
    recipients,
    url,
    text,
    title,
    content: context.content || "",
    image: context.image || "",
    moduleKey,
    eventKey,
    entityType,
    entityId: entityId ? String(entityId) : undefined,
    payload: {
      ...context,
      moduleKey,
      eventKey,
      entityType,
      entityId: entityId ? String(entityId) : "",
    },
    channel: "in_app",
  });

  await notify.save();
  await notify.populate("user", "avatar username");

  emitNotifyToRecipients(notify);

  let push = { skipped: true };
  if (config.rule.push_enabled) {
    const pushRecipients = await filterRecipientsByPreferences(
      recipients,
      config.preference_key,
      { forPush: true }
    );

    if (pushRecipients.length) {
      push = await pushNotificationService.sendToUsers(pushRecipients, {
        title,
        body: text,
        image: context.image || "",
        data: {
          type: "social_notification",
          moduleKey,
          eventKey,
          entityType: entityType || "",
          entityId: entityId ? String(entityId) : "",
          url: url || "",
          actorUserId: actorUser?._id ? String(actorUser._id) : "",
        },
      });
    }
  }

  return { success: true, notify, recipients, push };
};

const removeSocialNotification = async ({
  notifyId,
  url,
  recipientIds = [],
}) => {
  const query = { id: notifyId };
  if (url) query.url = url;

  const notify = await Notifies.findOneAndDelete(query);
  if (!notify) return null;

  const msg = {
    id: notifyId,
    url: notify.url || url,
    recipients: recipientIds.length ? recipientIds : notify.recipients,
  };

  emitRemoveNotify(msg);
  return notify;
};

const getUnreadCount = async (userId) =>
  Notifies.countDocuments({ recipients: userId, isRead: false });

module.exports = {
  dispatchSocialEvent,
  removeSocialNotification,
  getUnreadCount,
  filterRecipientsByPreferences,
};
