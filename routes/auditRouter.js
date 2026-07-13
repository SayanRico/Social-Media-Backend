const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const auditCtrl = require("../controllers/auditCtrl");

router.get(
  "/admin/audit",
  auth,
  requirePermission("audit.read"),
  auditCtrl.getLogs
);

module.exports = router;
