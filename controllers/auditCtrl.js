const AuditEvent = require("../models/auditEventModel");

const auditCtrl = {
  getLogs: async (req, res, next) => {
    try {
      const {
        action,
        resourceType,
        actorId,
        page = 1,
        limit = 50,
      } = req.query;

      const filter = {};
      if (action) filter.action = { $regex: action, $options: "i" };
      if (resourceType) filter.resourceType = resourceType;
      if (actorId) filter.actorId = actorId;

      const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const logs = await AuditEvent.find(filter)
        .sort("-createdAt")
        .skip(skip)
        .limit(parseInt(limit, 10))
        .populate("actorId", "username email adminRole");

      const total = await AuditEvent.countDocuments(filter);
      res.json({ logs, total, page: parseInt(page, 10) });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = auditCtrl;
