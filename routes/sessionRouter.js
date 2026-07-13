const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const sessionCtrl = require("../controllers/sessionCtrl");

router.get("/sessions", auth, sessionCtrl.getMySessions);
router.delete("/sessions/:id", auth, sessionCtrl.revokeSession);
router.post("/sessions/revoke-all", auth, sessionCtrl.revokeAllSessions);

router.get(
  "/admin/users/:userId/sessions",
  auth,
  requirePermission("users.read"),
  sessionCtrl.getUserSessions
);

module.exports = router;
