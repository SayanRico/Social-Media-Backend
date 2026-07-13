const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const featureFlagCtrl = require("../controllers/featureFlagCtrl");

router.get("/flags/:key", featureFlagCtrl.check);

router.get(
  "/admin/flags",
  auth,
  requirePermission("flags.manage"),
  featureFlagCtrl.getAll
);
router.post(
  "/admin/flags",
  auth,
  requirePermission("flags.manage"),
  featureFlagCtrl.upsert
);
router.delete(
  "/admin/flags/:key",
  auth,
  requirePermission("flags.manage"),
  featureFlagCtrl.remove
);

module.exports = router;
