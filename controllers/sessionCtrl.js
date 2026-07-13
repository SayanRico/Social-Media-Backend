const Session = require("../models/sessionModel");
const { auditFromReq } = require("../utils/auditLogger");
const { bumpTokenVersion } = require("./authCtrl");

const sessionCtrl = {
  getMySessions: async (req, res, next) => {
    try {
      const sessions = await Session.find({
        user: req.user._id,
        revoked: false,
      })
        .sort("-lastActive")
        .select("-__v");
      res.json({ sessions });
    } catch (err) {
      return next(err);
    }
  },

  revokeSession: async (req, res, next) => {
    try {
      const session = await Session.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { revoked: true },
        { new: true }
      );
      if (!session) return res.status(404).json({ msg: "Session not found." });
      res.json({ msg: "Session revoked." });
    } catch (err) {
      return next(err);
    }
  },

  revokeAllSessions: async (req, res, next) => {
    try {
      await Session.updateMany(
        { user: req.user._id, revoked: false },
        { revoked: true }
      );
      await bumpTokenVersion(req.user._id);
      res.clearCookie("refreshtoken", { path: "/api/refresh_token" });
      res.json({ msg: "All sessions revoked." });
    } catch (err) {
      return next(err);
    }
  },

  /** Admin: list user sessions */
  getUserSessions: async (req, res, next) => {
    try {
      const sessions = await Session.find({ user: req.params.userId })
        .sort("-lastActive")
        .limit(20);
      res.json({ sessions });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = sessionCtrl;
