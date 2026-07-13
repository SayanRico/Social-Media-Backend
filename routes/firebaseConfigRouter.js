const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const firebaseConfigCtrl = require("../controllers/firebaseConfigCtrl");

router.get("/integrations/firebase/public", firebaseConfigCtrl.getPublic);

router.get(
  "/admin/integrations/firebase",
  auth,
  requirePermission("integrations.manage"),
  firebaseConfigCtrl.getAdmin
);

router.put(
  "/admin/integrations/firebase",
  auth,
  requirePermission("integrations.manage"),
  firebaseConfigCtrl.upsert
);

module.exports = router;
