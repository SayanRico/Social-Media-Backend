const { getCatalog } = require("../config/notificationCatalog");
const {
  dispatchSocialEvent,
  getUnreadCount,
} = require("../services/notificationEngineService");

const notificationEngineCtrl = {
  getCatalog: async (req, res, next) => {
    try {
      res.json({ catalog: getCatalog() });
    } catch (err) {
      return next(err);
    }
  },

  getUnreadCount: async (req, res, next) => {
    try {
      const count = await getUnreadCount(req.user._id);
      res.json({ count });
    } catch (err) {
      return next(err);
    }
  },

  dispatchTest: async (req, res, next) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ msg: "Admin only." });
      }
      const { eventKey, recipientIds, context } = req.body;
      const result = await dispatchSocialEvent({
        eventKey,
        actorUser: req.user,
        recipientIds,
        entityType: "test",
        entityId: req.body.entityId,
        context,
      });
      res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = notificationEngineCtrl;
