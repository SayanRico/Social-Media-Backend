const Posts = require("../models/postModel");
const Users = require("../models/userModel");
const Comments = require("../models/commentModel");
const mongoose = require("mongoose");
const { auditFromReq } = require("../utils/auditLogger");
const { dispatchSocialEvent } = require("../services/notificationEngineService");

/** Spam = at least 2 reports (reports[1] exists). */
const SPAM_FILTER = { "reports.1": { $exists: true } };

const adminCtrl = {
  getTotalUsers: async (req, res, next) => {
    try {
      const total_users = await Users.countDocuments();
      res.json({ total_users });
    } catch (err) {
      return next(err);
    }
  },

  getTotalPosts: async (req, res, next) => {
    try {
      const total_posts = await Posts.countDocuments();
      res.json({ total_posts });
    } catch (err) {
      return next(err);
    }
  },

  getTotalComments: async (req, res, next) => {
    try {
      const total_comments = await Comments.countDocuments();
      res.json({ total_comments });
    } catch (err) {
      return next(err);
    }
  },

  getTotalLikes: async (req, res, next) => {
    try {
      const result = await Posts.aggregate([
        {
          $group: {
            _id: null,
            total_likes: { $sum: { $size: { $ifNull: ["$likes", []] } } },
          },
        },
      ]);
      const total_likes = result[0]?.total_likes || 0;
      res.json({ total_likes });
    } catch (err) {
      return next(err);
    }
  },

  getTotalSpamPosts: async (req, res, next) => {
    try {
      const total_spam_posts = await Posts.countDocuments(SPAM_FILTER);
      res.json({ total_spam_posts });
    } catch (err) {
      return next(err);
    }
  },

  getSpamPosts: async (req, res, next) => {
    try {
      const spamPosts = await Posts.find(SPAM_FILTER)
        .select("user createdAt reports content")
        .populate({ path: "user", select: "username avatar email" });

      res.json({ spamPosts });
    } catch (err) {
      return next(err);
    }
  },

  deleteSpamPost: async (req, res, next) => {
    try {
      const post = await Posts.findOneAndDelete({
        _id: req.params.id,
      });

      if (!post) {
        return res.status(400).json({ msg: "Post does not exist." });
      }

      await Comments.deleteMany({ _id: { $in: post.comments } });

      await dispatchSocialEvent({
        eventKey: "admin_action",
        actorUser: req.user,
        recipientIds: [post.user],
        entityType: "post",
        entityId: post._id,
        context: {
          actionText: "Your post was removed due to too many reports.",
          actionUrl: `/profile/${post.user}`,
        },
      });

      res.json({ msg: "Post deleted successfully." });
    } catch (err) {
      return next(err);
    }
  },

  /** Ban a user and invalidate all of their JWTs. */
  banUser: async (req, res, next) => {
    try {
      const user = await Users.findOneAndUpdate(
        { _id: req.params.id, role: { $ne: "admin" } },
        { status: "banned", $inc: { tokenVersion: 1 } },
        { new: true }
      ).select("-password");

      if (!user) {
        return res.status(400).json({ msg: "User not found or cannot ban admin." });
      }

      await auditFromReq(req, {
        action: "user.ban",
        resourceType: "user",
        resourceId: user._id,
        afterState: { status: "banned" },
      });

      res.json({ msg: "User banned.", user });
    } catch (err) {
      return next(err);
    }
  },

  unbanUser: async (req, res, next) => {
    try {
      const user = await Users.findOneAndUpdate(
        { _id: req.params.id },
        { status: "active", $inc: { tokenVersion: 1 } },
        { new: true }
      ).select("-password");

      if (!user) {
        return res.status(400).json({ msg: "User not found." });
      }

      await auditFromReq(req, {
        action: "user.unban",
        resourceType: "user",
        resourceId: user._id,
        afterState: { status: "active" },
      });

      res.json({ msg: "User unbanned.", user });
    } catch (err) {
      return next(err);
    }
  },

  getSystemHealth: async (req, res, next) => {
    try {
      const mongoState = mongoose.connection.readyState;
      const mongo =
        mongoState === 1 ? "up" : mongoState === 2 ? "connecting" : "down";

      res.json({
        api: "up",
        mongo,
        redis: process.env.SOCKET_IO_REDIS_ADAPTER_ENABLED === "1" ? "configured" : "optional",
        socket: "up",
        timestamp: new Date().toISOString(),
        uptime: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = adminCtrl;
