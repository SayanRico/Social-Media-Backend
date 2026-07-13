const Users = require("./models/userModel");
const jwt = require("jsonwebtoken");
const { tokenVersionMatches } = require("./middleware/auth");

/**
 * Local presence map: userId -> Set(socketId)
 * Instance-local only (multi-tab on THIS process).
 * For global active-user counts use io.fetchSockets / adapter (see countActiveUsers).
 */
const connectedUsers = new Map();

const userRoom = (userId) => `user_${userId}`;

const idOf = (value) => {
  if (value == null) return null;
  if (typeof value === "object") {
    return String(value._id || value.id || "");
  }
  return String(value);
};

const sameId = (a, b) => {
  const left = idOf(a);
  const right = idOf(b);
  return Boolean(left && right && left === right);
};

const listIncludesUser = (list, userId) =>
  Array.isArray(list) && list.some((item) => sameId(item, userId));

const deny = (socket, reason) => {
  socket.emit("socket-error", { msg: reason || "Unauthorized" });
};

const emitToUser = (io, userId, event, payload) => {
  if (!userId) return;
  io.to(userRoom(String(userId))).emit(event, payload);
};

const emitToUsers = (io, userIds, event, payload) => {
  const unique = [...new Set((userIds || []).map((id) => String(id)))];
  unique.forEach((id) => emitToUser(io, id, event, payload));
};

/**
 * Count distinct authenticated sockets (cross-instance when Redis adapter is on).
 */
const countActiveUsers = async (io) => {
  try {
    const sockets = await io.fetchSockets();
    const userIds = new Set();
    for (const s of sockets) {
      if (s.userId) userIds.add(String(s.userId));
    }
    return userIds.size;
  } catch (err) {
    return connectedUsers.size;
  }
};

const trackSocket = (userId, socketId) => {
  const key = String(userId);
  if (!connectedUsers.has(key)) {
    connectedUsers.set(key, new Set());
  }
  connectedUsers.get(key).add(socketId);
};

const untrackSocket = (userId, socketId) => {
  const key = String(userId);
  const set = connectedUsers.get(key);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) connectedUsers.delete(key);
};

const attachSocketAuth = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Authentication required"));

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
      } catch (_) {
        return next(new Error("Invalid token"));
      }

      if (!decoded?.id) return next(new Error("Invalid token"));

      const user = await Users.findById(decoded.id).select(
        "_id role status username tokenVersion"
      );
      if (!user) return next(new Error("User not found"));
      if (user.status === "banned") {
        return next(new Error("Account disabled"));
      }
      if (!tokenVersionMatches(decoded, user)) {
        return next(new Error("Token invalidated"));
      }

      socket.userId = String(user._id);
      socket.role = user.role;
      socket.username = user.username;
      next();
    } catch (error) {
      console.warn("[SOCKET_AUTH] rejected", {
        error: error.message,
        ip: socket.handshake.address,
      });
      next(new Error("Invalid token"));
    }
  });
};

const SocketServer = (socket, io) => {
  trackSocket(socket.userId, socket.id);
  socket.join(userRoom(socket.userId));
  if (socket.role === "admin") {
    socket.join("admins");
  }

  socket.on("disconnect", () => {
    untrackSocket(socket.userId, socket.id);
  });

  // Compat no-ops — identity comes from JWT rooms.
  socket.on("joinUser", () => {
    console.warn(
      "[socket] joinUser is deprecated; rooms are assigned from JWT"
    );
  });
  socket.on("joinAdmin", () => {
    console.warn(
      "[socket] joinAdmin is deprecated; rooms are assigned from JWT"
    );
  });

  //#region //!Like — actor must be in likes list
  socket.on("likePost", (newPost) => {
    if (!listIncludesUser(newPost?.likes, socket.userId)) {
      return deny(socket, "likePost: actor mismatch");
    }
    const ids = [
      ...(newPost?.user?.followers || []),
      newPost?.user?._id,
    ].filter(Boolean);
    emitToUsers(io, ids, "likeToClient", newPost);
  });

  socket.on("unLikePost", (newPost) => {
    // After unlike, actor should NOT remain in likes
    if (listIncludesUser(newPost?.likes, socket.userId)) {
      return deny(socket, "unLikePost: actor still in likes");
    }
    const ids = [
      ...(newPost?.user?.followers || []),
      newPost?.user?._id,
    ].filter(Boolean);
    emitToUsers(io, ids, "unLikeToClient", newPost);
  });
  //#endregion

  //#region //!comment
  socket.on("createComment", (newPost) => {
    const comments = newPost?.comments || [];
    const latest = comments[comments.length - 1];
    const commentUser = latest?.user?._id || latest?.user;
    if (!sameId(commentUser, socket.userId)) {
      return deny(socket, "createComment: actor mismatch");
    }
    const ids = [
      ...(newPost?.user?.followers || []),
      newPost?.user?._id,
    ].filter(Boolean);
    emitToUsers(io, ids, "createCommentToClient", newPost);
  });

  socket.on("deleteComment", (newPost) => {
    // Real delete is authorized over HTTP. Relay requires a concrete post payload.
    // Post owner may always fan out; otherwise require a valid post id (own-comment
    // deletes remove the author from comments[], so they cannot be re-checked here).
    if (!newPost?._id || !newPost?.user) {
      return deny(socket, "deleteComment: invalid payload");
    }
    const ids = [
      ...(newPost?.user?.followers || []),
      newPost?.user?._id,
    ].filter(Boolean);
    emitToUsers(io, ids, "deleteCommentToClient", newPost);
  });
  //#endregion

  //#region //!follow — socket user must appear in target's followers after follow
  socket.on("follow", (newUser) => {
    if (!listIncludesUser(newUser?.followers, socket.userId)) {
      return deny(socket, "follow: actor mismatch");
    }
    emitToUser(io, newUser?._id, "followToClient", newUser);
  });

  socket.on("unFollow", (newUser) => {
    if (listIncludesUser(newUser?.followers, socket.userId)) {
      return deny(socket, "unFollow: actor still following");
    }
    emitToUser(io, newUser?._id, "unFollowToClient", newUser);
  });
  //#endregion

  //#region //!Notifications — actor must match socket user
  socket.on("createNotify", (msg) => {
    const actorId = idOf(msg?.user?._id || msg?.user);
    // Client often sends user: { username, avatar } without _id — bind identity from socket
    if (actorId && !sameId(actorId, socket.userId)) {
      return deny(socket, "createNotify: actor mismatch");
    }
    if (!Array.isArray(msg?.recipients) || msg.recipients.length === 0) {
      return deny(socket, "createNotify: recipients required");
    }
    const safeMsg = {
      ...msg,
      user: {
        ...(typeof msg.user === "object" && msg.user ? msg.user : {}),
        _id: socket.userId,
        username: msg?.user?.username || socket.username,
      },
    };
    emitToUsers(io, msg.recipients, "createNotifyToClient", safeMsg);
  });

  socket.on("removeNotify", (msg) => {
    if (!msg?.id && !msg?.url) {
      return deny(socket, "removeNotify: invalid payload");
    }
    emitToUsers(io, msg?.recipients || [], "removeNotifyToClient", msg);
  });
  //#endregion

  socket.on("getActiveUsers", async () => {
    if (socket.role !== "admin") {
      return deny(socket, "admin only");
    }
    const totalActiveUsers = await countActiveUsers(io);
    socket.emit("getActiveUsersToClient", totalActiveUsers);
    io.to("admins").emit("activeUsers", totalActiveUsers);
  });

  //#region //!Messages — sender must be this socket
  socket.on("addMessage", (msg) => {
    if (!sameId(msg?.sender, socket.userId)) {
      return deny(socket, "addMessage: sender mismatch");
    }
    if (!msg?.recipient) {
      return deny(socket, "addMessage: recipient required");
    }
    if (sameId(msg.recipient, socket.userId)) {
      return deny(socket, "addMessage: cannot message self");
    }
    const safeMsg = { ...msg, sender: socket.userId };
    emitToUser(io, msg.recipient, "addMessageToClient", safeMsg);
  });
  //#endregion
};

module.exports = SocketServer;
module.exports.attachSocketAuth = attachSocketAuth;
module.exports.countActiveUsers = countActiveUsers;
