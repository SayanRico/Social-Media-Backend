const UserDevice = require("../models/userDeviceModel");

const deviceCtrl = {
  register: async (req, res, next) => {
    try {
      const { token, platform = "web" } = req.body;
      if (!token) {
        return res.status(400).json({ msg: "Device token is required." });
      }

      const device = await UserDevice.findOneAndUpdate(
        { token },
        {
          user: req.user._id,
          token,
          platform,
          userAgent: req.headers["user-agent"] || "",
          isActive: true,
          lastSeenAt: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      res.json({ msg: "Device registered.", device });
    } catch (err) {
      return next(err);
    }
  },

  unregister: async (req, res, next) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ msg: "Device token is required." });
      }

      await UserDevice.findOneAndUpdate(
        { token, user: req.user._id },
        { isActive: false }
      );

      res.json({ msg: "Device unregistered." });
    } catch (err) {
      return next(err);
    }
  },

  listMine: async (req, res, next) => {
    try {
      const devices = await UserDevice.find({
        user: req.user._id,
        isActive: true,
      }).select("platform lastSeenAt createdAt");

      res.json({ devices });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = deviceCtrl;
