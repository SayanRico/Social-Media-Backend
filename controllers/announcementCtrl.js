const Announcements = require("../models/announcementModel");
const { auditFromReq } = require("../utils/auditLogger");

const announcementCtrl = {
  getActive: async (req, res, next) => {
    try {
      const now = new Date();
      const items = await Announcements.find({
        active: true,
        startsAt: { $lte: now },
        $or: [{ endsAt: null }, { endsAt: { $gte: now } }],
      })
        .sort("-startsAt")
        .select("title body type startsAt endsAt")
        .limit(5);
      res.json({ announcements: items });
    } catch (err) {
      return next(err);
    }
  },

  getAll: async (req, res, next) => {
    try {
      const items = await Announcements.find().sort("-createdAt");
      res.json({ announcements: items });
    } catch (err) {
      return next(err);
    }
  },

  create: async (req, res, next) => {
    try {
      const { title, body, type, active, startsAt, endsAt } = req.body;
      if (!title || !body) {
        return res.status(400).json({ msg: "title and body required." });
      }

      const item = await Announcements.create({
        title,
        body,
        type: type || "info",
        active: active !== false,
        startsAt: startsAt || new Date(),
        endsAt: endsAt || null,
        createdBy: req.user._id,
      });

      await auditFromReq(req, {
        action: "announcement.create",
        resourceType: "announcement",
        resourceId: item._id,
      });

      res.json({ msg: "Announcement created.", announcement: item });
    } catch (err) {
      return next(err);
    }
  },

  update: async (req, res, next) => {
    try {
      const item = await Announcements.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!item) return res.status(404).json({ msg: "Not found." });

      await auditFromReq(req, {
        action: "announcement.update",
        resourceType: "announcement",
        resourceId: item._id,
      });

      res.json({ announcement: item });
    } catch (err) {
      return next(err);
    }
  },

  remove: async (req, res, next) => {
    try {
      await Announcements.findByIdAndDelete(req.params.id);
      await auditFromReq(req, {
        action: "announcement.delete",
        resourceType: "announcement",
        resourceId: req.params.id,
      });
      res.json({ msg: "Deleted." });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = announcementCtrl;
