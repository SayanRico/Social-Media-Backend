const Notifies = require("../models/notifyModel");
const { emitNotifyToRecipients, emitRemoveNotify } = require("../utils/socketEmitter");

const notifyCtrl = {
  createNotify: async (req, res, next) => {
    try {
      const { id, recipients, url, text, content, image } = req.body;

      if (!recipients || recipients.includes(req.user._id.toString())) {
        return res.status(200).json({ msg: "Skipped self notify." });
      }

      const notify = new Notifies({
        id,
        recipients,
        url,
        text,
        content,
        image,
        user: req.user._id,
        moduleKey: "social",
        channel: "in_app",
      });

      await notify.save();
      await notify.populate("user", "avatar username");
      emitNotifyToRecipients(notify);

      return res.json({ notify });
    } catch (err) {
      return next(err);
    }
  },

  removeNotify: async (req, res, next) => {
    try {
      const notify = await Notifies.findOneAndDelete({
        id: req.params.id,
        url: req.query.url,
        recipients: req.user._id,
      });
      if (!notify) {
        return res.status(404).json({ msg: "Notification not found." });
      }
      emitRemoveNotify({
        id: notify.id,
        url: notify.url,
        recipients: notify.recipients,
      });
      return res.json({ notify });
    } catch (err) {
      return next(err);
    }
  },

  getNotifies: async (req, res, next) => {
    try {
      const notifies = await Notifies.find({ recipients: req.user._id })
        .sort("-createdAt")
        .populate("user", "avatar username");

      return res.json({ notifies });
    } catch (err) {
      return next(err);
    }
  },

  isReadNotify: async (req, res, next) => {
    try {
      const notifies = await Notifies.findOneAndUpdate(
        { _id: req.params.id, recipients: req.user._id },
        { isRead: true },
        { new: true }
      );

      if (!notifies) {
        return res.status(404).json({ msg: "Notification not found." });
      }

      return res.json({ notifies });
    } catch (err) {
      return next(err);
    }
  },

  deleteAllNotifies: async (req, res, next) => {
    try {
      const notifies = await Notifies.deleteMany({ recipients: req.user._id });

      return res.json({ notifies });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = notifyCtrl;
