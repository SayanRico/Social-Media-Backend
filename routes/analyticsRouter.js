const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const analyticsCtrl = require("../controllers/analyticsCtrl");

router.post("/analytics/track", auth, analyticsCtrl.track);

router.get(
  "/admin/analytics/overview",
  auth,
  requirePermission("analytics.read"),
  analyticsCtrl.getOverview
);
router.get(
  "/admin/analytics/trends",
  auth,
  requirePermission("analytics.read"),
  analyticsCtrl.getTrends
);
router.get(
  "/admin/analytics/top-posts",
  auth,
  requirePermission("analytics.read"),
  analyticsCtrl.getTopPosts
);

module.exports = router;
