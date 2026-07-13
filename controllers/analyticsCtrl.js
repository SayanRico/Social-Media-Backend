const AnalyticsEvent = require("../models/analyticsEventModel");
const Users = require("../models/userModel");
const Posts = require("../models/postModel");
const Comments = require("../models/commentModel");
const Reports = require("../models/reportModel");
const mongoose = require("mongoose");

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

const analyticsCtrl = {
  /** POST /api/analytics/track — client event beacon */
  track: async (req, res, next) => {
    try {
      const { event, metadata } = req.body;
      if (!event) return res.status(400).json({ msg: "event required." });

      await AnalyticsEvent.create({
        userId: req.user?._id || null,
        event,
        metadata: metadata || {},
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/analytics/overview */
  getOverview: async (req, res, next) => {
    try {
      const today = startOfDay();
      const weekAgo = daysAgo(7);
      const monthAgo = daysAgo(30);

      const [
        total_users,
        total_posts,
        total_comments,
        registrations_today,
        posts_today,
        comments_today,
        reports_open,
        banned_users,
      ] = await Promise.all([
        Users.countDocuments(),
        Posts.countDocuments(),
        Comments.countDocuments(),
        Users.countDocuments({ createdAt: { $gte: today } }),
        Posts.countDocuments({ createdAt: { $gte: today } }),
        Comments.countDocuments({ createdAt: { $gte: today } }),
        Reports.countDocuments({
          status: { $in: ["submitted", "triaged", "under_review", "appealed"] },
        }),
        Users.countDocuments({ status: "banned" }),
      ]);

      const dau = await AnalyticsEvent.distinct("userId", {
        userId: { $ne: null },
        createdAt: { $gte: today },
        event: { $in: ["login", "session_start", "page_view"] },
      });

      const wau = await AnalyticsEvent.distinct("userId", {
        userId: { $ne: null },
        createdAt: { $gte: weekAgo },
        event: { $in: ["login", "session_start", "page_view"] },
      });

      const mau = await AnalyticsEvent.distinct("userId", {
        userId: { $ne: null },
        createdAt: { $gte: monthAgo },
        event: { $in: ["login", "session_start", "page_view"] },
      });

      const engagement =
        total_posts > 0
          ? Math.round((total_comments / total_posts) * 100) / 100
          : 0;

      res.json({
        total_users,
        total_posts,
        total_comments,
        registrations_today,
        posts_today,
        comments_today,
        reports_open,
        banned_users,
        dau: dau.length,
        wau: wau.length,
        mau: mau.length,
        stickiness:
          mau.length > 0
            ? Math.round((dau.length / mau.length) * 1000) / 10
            : 0,
        engagement_rate: engagement,
      });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/analytics/trends?days=30 */
  getTrends: async (req, res, next) => {
    try {
      const days = Math.min(90, parseInt(req.query.days, 10) || 30);
      const since = daysAgo(days);

      const registrationTrend = await Users.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      const postTrend = await Posts.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      res.json({ registrationTrend, postTrend, days });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/analytics/top-posts */
  getTopPosts: async (req, res, next) => {
    try {
      const posts = await Posts.aggregate([
        {
          $addFields: {
            likeCount: { $size: { $ifNull: ["$likes", []] } },
            commentCount: { $size: { $ifNull: ["$comments", []] } },
          },
        },
        {
          $addFields: {
            engagement: { $add: ["$likeCount", "$commentCount"] },
          },
        },
        { $sort: { engagement: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "author",
          },
        },
        { $unwind: { path: "$author", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            content: 1,
            createdAt: 1,
            likeCount: 1,
            commentCount: 1,
            engagement: 1,
            "author.username": 1,
            "author.avatar": 1,
          },
        },
      ]);

      res.json({ posts });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = analyticsCtrl;
