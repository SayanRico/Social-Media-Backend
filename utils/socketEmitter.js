let ioInstance = null;

const setSocketIo = (io) => {
  ioInstance = io;
};

const userRoom = (userId) => `user_${String(userId)}`;

const emitToUser = (userId, event, payload) => {
  if (!ioInstance || !userId) return;
  ioInstance.to(userRoom(userId)).emit(event, payload);
};

const emitToUsers = (userIds, event, payload) => {
  const unique = [...new Set((userIds || []).map((id) => String(id)))];
  unique.forEach((id) => emitToUser(id, event, payload));
};

const emitNotifyToRecipients = (notifyDoc) => {
  if (!notifyDoc) return;
  const payload = notifyDoc.toObject ? notifyDoc.toObject() : notifyDoc;
  emitToUsers(payload.recipients, "createNotifyToClient", payload);
};

const emitRemoveNotify = (msg) => {
  emitToUsers(msg.recipients, "removeNotifyToClient", msg);
};

module.exports = {
  setSocketIo,
  emitToUser,
  emitToUsers,
  emitNotifyToRecipients,
  emitRemoveNotify,
};
