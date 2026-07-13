const FeatureFlags = require("../models/featureFlagModel");
const { auditFromReq } = require("../utils/auditLogger");

const featureFlagCtrl = {
  getAll: async (req, res, next) => {
    try {
      const flags = await FeatureFlags.find().sort("key");
      res.json({ flags });
    } catch (err) {
      return next(err);
    }
  },

  /** Public check — GET /api/flags/:key */
  check: async (req, res, next) => {
    try {
      const flag = await FeatureFlags.findOne({ key: req.params.key });
      if (!flag) return res.json({ enabled: false });
      res.json({
        enabled: flag.enabled,
        rolloutPercent: flag.rolloutPercent,
      });
    } catch (err) {
      return next(err);
    }
  },

  upsert: async (req, res, next) => {
    try {
      const { key, description, enabled, rolloutPercent } = req.body;
      if (!key) return res.status(400).json({ msg: "key required." });

      const flag = await FeatureFlags.findOneAndUpdate(
        { key },
        {
          key,
          description: description || "",
          enabled: Boolean(enabled),
          rolloutPercent: rolloutPercent ?? 100,
          updatedBy: req.user._id,
        },
        { upsert: true, new: true }
      );

      await auditFromReq(req, {
        action: "feature_flag.upsert",
        resourceType: "feature_flag",
        resourceId: flag._id,
        afterState: { key, enabled: flag.enabled },
      });

      res.json({ flag });
    } catch (err) {
      return next(err);
    }
  },

  remove: async (req, res, next) => {
    try {
      await FeatureFlags.findOneAndDelete({ key: req.params.key });
      await auditFromReq(req, {
        action: "feature_flag.delete",
        resourceType: "feature_flag",
        metadata: { key: req.params.key },
      });
      res.json({ msg: "Flag removed." });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = featureFlagCtrl;
