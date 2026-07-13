const Users = require("../models/userModel");
const Posts = require("../models/postModel");
const Comments = require("../models/commentModel");
const Reports = require("../models/reportModel");
const Strikes = require("../models/strikeModel");
const Appeals = require("../models/appealModel");
const { auditFromReq } = require("../utils/auditLogger");
const { trackEvent } = require("../utils/analyticsTracker");
const escapeRegex = require("../utils/escapeRegex");

const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2 };

const platformCtrl = {
  /** POST /api/reports — structured report (any entity) */
  createReport: async (req, res, next) => {
    try {
      const { entityType, entityId, reason, description, evidence } = req.body;
      if (!entityType || !entityId || !reason) {
        return res.status(400).json({ msg: "entityType, entityId, and reason are required." });
      }

      const existing = await Reports.findOne({
        reporter: req.user._id,
        entityType,
        entityId,
        status: { $nin: ["dismissed", "closed"] },
      });
      if (existing) {
        return res.status(400).json({ msg: "You already reported this item." });
      }

      let targetUser = null;
      if (entityType === "post") {
        const post = await Posts.findById(entityId);
        if (!post) return res.status(404).json({ msg: "Post not found." });
        targetUser = post.user;
        await Posts.findByIdAndUpdate(entityId, {
          $addToSet: { reports: req.user._id },
        });
      } else if (entityType === "user" || entityType === "profile") {
        targetUser = entityId;
      }

      const report = await Reports.create({
        entityType,
        entityId,
        reason,
        description: description || "",
        evidence: evidence || [],
        reporter: req.user._id,
        targetUser,
        status: "submitted",
      });

      await trackEvent({
        userId: req.user._id,
        event: "report_submitted",
        metadata: { entityType, reason },
        req,
      });

      res.json({ msg: "Report submitted.", report });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/reports — moderation queue */
  getReports: async (req, res, next) => {
    try {
      const { status, priority, entityType, page = 1, limit = 20 } = req.query;
      const filter = {};
      if (status) filter.status = status;
      if (priority) filter.priority = priority;
      if (entityType) filter.entityType = entityType;

      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const reports = await Reports.find(filter)
        .sort({ priority: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate("reporter assignee targetUser", "username avatar email")
        .lean();

      reports.sort(
        (a, b) =>
          (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)
      );

      const total = await Reports.countDocuments(filter);
      res.json({ reports, total, page: parseInt(page, 10) });
    } catch (err) {
      return next(err);
    }
  },

  /** PATCH /api/admin/reports/:id — assign, resolve, dismiss */
  updateReport: async (req, res, next) => {
    try {
      const { status, assignee, resolution, actionTaken } = req.body;
      const before = await Reports.findById(req.params.id);
      if (!before) return res.status(404).json({ msg: "Report not found." });

      const update = {};
      if (status) update.status = status;
      if (assignee !== undefined) update.assignee = assignee || null;
      if (resolution) update.resolution = resolution;
      if (actionTaken) update.actionTaken = actionTaken;
      if (status === "under_review" && !before.assignee) {
        update.assignee = req.user._id;
      }

      const report = await Reports.findByIdAndUpdate(req.params.id, update, {
        new: true,
      }).populate("reporter assignee targetUser", "username avatar");

      await auditFromReq(req, {
        action: "report.update",
        resourceType: "report",
        resourceId: report._id,
        beforeState: { status: before.status },
        afterState: { status: report.status, actionTaken: report.actionTaken },
      });

      res.json({ msg: "Report updated.", report });
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/admin/strikes — issue strike / suspension */
  issueStrike: async (req, res, next) => {
    try {
      const { userId, reason, action, durationHours, note, reportId } = req.body;
      if (!userId || !reason || !action) {
        return res.status(400).json({ msg: "userId, reason, and action are required." });
      }

      const user = await Users.findById(userId);
      if (!user) return res.status(404).json({ msg: "User not found." });
      if (user.role === "admin") {
        return res.status(400).json({ msg: "Cannot strike admin accounts." });
      }

      let expiresAt = null;

      let updates = { $inc: { strikeCount: 1 } };

      if (action === "suspend") {
        const hours = durationHours || 24;
        expiresAt = new Date(Date.now() + hours * 3600000);
        updates.status = "suspended";
        updates.suspendedUntil = expiresAt;
      } else if (action === "shadow_ban") {
        updates.shadowBanned = true;
      } else if (action === "ban") {
        updates.status = "banned";
        updates.$inc = { strikeCount: 1, tokenVersion: 1 };
      }

      const strike = await Strikes.create({
        user: userId,
        report: reportId || null,
        reason,
        action,
        durationHours: durationHours || 0,
        issuedBy: req.user._id,
        note: note || "",
        expiresAt,
      });

      await Users.findByIdAndUpdate(userId, updates);

      if (reportId) {
        await Reports.findByIdAndUpdate(reportId, {
          status: "action_taken",
          actionTaken: action,
        });
      }

      await auditFromReq(req, {
        action: "strike.issue",
        resourceType: "user",
        resourceId: userId,
        afterState: { action, reason, strikeId: strike._id },
      });

      res.json({ msg: "Strike issued.", strike });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/users/:id/360 — user 360 view */
  getUser360: async (req, res, next) => {
    try {
      const user = await Users.findById(req.params.id)
        .select("-password -totpSecret")
        .populate("followers following", "username avatar")
        .lean();

      if (!user) return res.status(404).json({ msg: "User not found." });

      const [posts, reportsFiled, reportsReceived, strikes, sessions] =
        await Promise.all([
          Posts.countDocuments({ user: user._id }),
          Reports.countDocuments({ reporter: user._id }),
          Reports.countDocuments({ targetUser: user._id }),
          Strikes.find({ user: user._id })
            .sort("-createdAt")
            .limit(20)
            .populate("issuedBy", "username")
            .lean(),
          require("../models/sessionModel")
            .find({ user: user._id, revoked: false })
            .sort("-lastActive")
            .limit(10)
            .lean(),
        ]);

      res.json({
        user,
        stats: {
          posts,
          reportsFiled,
          reportsReceived,
          strikeCount: user.strikeCount || 0,
        },
        strikes,
        sessions,
      });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/users/search — advanced user search */
  adminSearchUsers: async (req, res, next) => {
    try {
      const {
        q = "",
        status,
        role,
        adminRole,
        verified,
        tag,
        page = 1,
        limit = 20,
      } = req.query;

      const filter = {};
      if (q) {
        const safe = escapeRegex(q);
        filter.$or = [
          { username: { $regex: safe, $options: "i" } },
          { email: { $regex: safe, $options: "i" } },
          { fullname: { $regex: safe, $options: "i" } },
        ];
      }
      if (status) filter.status = status;
      if (role) filter.role = role;
      if (adminRole) filter.adminRole = adminRole;
      if (verified === "true") filter.verified = true;
      if (tag) filter.tags = tag;

      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const users = await Users.find(filter)
        .select("-password -totpSecret")
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit, 10));

      const total = await Users.countDocuments(filter);
      res.json({ users, total, page: parseInt(page, 10) });
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/admin/users/bulk — bulk ban/unban/suspend */
  bulkUserAction: async (req, res, next) => {
    try {
      const { userIds, action, durationHours } = req.body;
      if (!Array.isArray(userIds) || !userIds.length || !action) {
        return res.status(400).json({ msg: "userIds array and action required." });
      }

      const filter = { _id: { $in: userIds }, role: { $ne: "admin" } };
      let update = {};

      if (action === "ban") {
        update = { status: "banned", $inc: { tokenVersion: 1 } };
      } else if (action === "unban") {
        update = { status: "active", suspendedUntil: null, $inc: { tokenVersion: 1 } };
      } else if (action === "suspend") {
        const until = new Date(
          Date.now() + (durationHours || 24) * 3600000
        );
        update = { status: "suspended", suspendedUntil: until };
      } else {
        return res.status(400).json({ msg: "Invalid bulk action." });
      }

      const result = await Users.updateMany(filter, update);

      await auditFromReq(req, {
        action: `users.bulk_${action}`,
        resourceType: "user",
        metadata: { userIds, count: result.nModified },
      });

      res.json({ msg: `Bulk ${action} applied.`, modified: result.nModified });
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/admin/users/:id/notes */
  addModeratorNote: async (req, res, next) => {
    try {
      const { text } = req.body;
      if (!text?.trim()) {
        return res.status(400).json({ msg: "Note text required." });
      }

      const user = await Users.findByIdAndUpdate(
        req.params.id,
        {
          $push: {
            moderatorNotes: {
              text: text.trim(),
              author: req.user._id,
              createdAt: new Date(),
            },
          },
        },
        { new: true }
      ).select("-password -totpSecret");

      if (!user) return res.status(404).json({ msg: "User not found." });

      await auditFromReq(req, {
        action: "user.note_add",
        resourceType: "user",
        resourceId: user._id,
      });

      res.json({ msg: "Note added.", user });
    } catch (err) {
      return next(err);
    }
  },

  /** POST /api/appeals */
  createAppeal: async (req, res, next) => {
    try {
      const { reportId, reason } = req.body;
      if (!reportId || !reason) {
        return res.status(400).json({ msg: "reportId and reason required." });
      }

      const report = await Reports.findById(reportId);
      if (!report) return res.status(404).json({ msg: "Report not found." });

      const existing = await Appeals.findOne({
        report: reportId,
        user: req.user._id,
        status: "pending",
      });
      if (existing) {
        return res.status(400).json({ msg: "Appeal already pending." });
      }

      const appeal = await Appeals.create({
        report: reportId,
        user: req.user._id,
        reason,
      });

      await Reports.findByIdAndUpdate(reportId, { status: "appealed" });

      res.json({ msg: "Appeal submitted.", appeal });
    } catch (err) {
      return next(err);
    }
  },

  /** GET /api/admin/appeals */
  getAppeals: async (req, res, next) => {
    try {
      const { status = "pending" } = req.query;
      const appeals = await Appeals.find({ status })
        .sort("-createdAt")
        .populate("user", "username avatar email")
        .populate({
          path: "report",
          populate: { path: "reporter", select: "username" },
        });
      res.json({ appeals });
    } catch (err) {
      return next(err);
    }
  },

  /** PATCH /api/admin/appeals/:id */
  resolveAppeal: async (req, res, next) => {
    try {
      const { status, reviewNote } = req.body;
      if (!["approved", "denied"].includes(status)) {
        return res.status(400).json({ msg: "status must be approved or denied." });
      }

      const appeal = await Appeals.findByIdAndUpdate(
        req.params.id,
        {
          status,
          reviewNote: reviewNote || "",
          reviewedBy: req.user._id,
        },
        { new: true }
      );

      if (!appeal) return res.status(404).json({ msg: "Appeal not found." });

      if (status === "approved") {
        await Users.findByIdAndUpdate(appeal.user, {
          status: "active",
          suspendedUntil: null,
          shadowBanned: false,
          $inc: { tokenVersion: 1 },
        });
        await Reports.findByIdAndUpdate(appeal.report, { status: "dismissed" });
      } else {
        await Reports.findByIdAndUpdate(appeal.report, { status: "closed" });
      }

      await auditFromReq(req, {
        action: "appeal.resolve",
        resourceType: "appeal",
        resourceId: appeal._id,
        afterState: { status },
      });

      res.json({ msg: "Appeal resolved.", appeal });
    } catch (err) {
      return next(err);
    }
  },

  /** PATCH /api/admin/users/:id/shadow-ban */
  toggleShadowBan: async (req, res, next) => {
    try {
      const user = await Users.findById(req.params.id);
      if (!user || user.role === "admin") {
        return res.status(400).json({ msg: "Invalid user." });
      }

      const updated = await Users.findByIdAndUpdate(
        req.params.id,
        { shadowBanned: !user.shadowBanned },
        { new: true }
      ).select("-password -totpSecret");

      await auditFromReq(req, {
        action: updated.shadowBanned ? "user.shadow_ban" : "user.shadow_unban",
        resourceType: "user",
        resourceId: user._id,
      });

      res.json({
        msg: updated.shadowBanned ? "Shadow ban enabled." : "Shadow ban removed.",
        user: updated,
      });
    } catch (err) {
      return next(err);
    }
  },

  /** PATCH /api/admin/users/:id/suspend */
  suspendUser: async (req, res, next) => {
    try {
      const { durationHours = 24, reason } = req.body;
      const until = new Date(Date.now() + durationHours * 3600000);

      const user = await Users.findOneAndUpdate(
        { _id: req.params.id, role: { $ne: "admin" } },
        { status: "suspended", suspendedUntil: until, $inc: { strikeCount: 1 } },
        { new: true }
      ).select("-password -totpSecret");

      if (!user) return res.status(404).json({ msg: "User not found." });

      await Strikes.create({
        user: user._id,
        reason: reason || "admin_suspend",
        action: "suspend",
        durationHours,
        issuedBy: req.user._id,
        expiresAt: until,
      });

      await auditFromReq(req, {
        action: "user.suspend",
        resourceType: "user",
        resourceId: user._id,
        afterState: { until },
      });

      res.json({ msg: `Suspended for ${durationHours}h.`, user });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = platformCtrl;
