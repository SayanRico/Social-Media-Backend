const firebaseConfigService = require("../services/firebaseConfigService");
const { auditFromReq } = require("../utils/auditLogger");
const { resetFirebaseAdmin } = require("../config/firebaseAdmin");

const firebaseConfigCtrl = {
  getPublic: async (req, res, next) => {
    try {
      const config = await firebaseConfigService.getPublicConfig();
      res.json(config);
    } catch (err) {
      return next(err);
    }
  },

  getAdmin: async (req, res, next) => {
    try {
      const config = await firebaseConfigService.getAdminConfig();
      res.json({ config });
    } catch (err) {
      return next(err);
    }
  },

  upsert: async (req, res, next) => {
    try {
      await firebaseConfigService.upsertConfig(req.body, req.user._id);
      await resetFirebaseAdmin();

      await auditFromReq(req, {
        action: "firebase_config.update",
        resourceType: "firebase_config",
        resourceId: "default",
        afterState: {
          enabled: Boolean(req.body.enabled),
          projectId: req.body.projectId || "",
        },
      });

      const config = await firebaseConfigService.getAdminConfig();
      res.json({ msg: "Firebase configuration saved.", config });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = firebaseConfigCtrl;
