const router = require("express").Router();
const auth = require("../middleware/auth");
const { requirePermission } = require("../utils/permissions");
const announcementCtrl = require("../controllers/announcementCtrl");

router.get("/announcements", announcementCtrl.getActive);

router.get(
  "/admin/announcements",
  auth,
  requirePermission("announcements.manage"),
  announcementCtrl.getAll
);
router.post(
  "/admin/announcements",
  auth,
  requirePermission("announcements.manage"),
  announcementCtrl.create
);
router.patch(
  "/admin/announcements/:id",
  auth,
  requirePermission("announcements.manage"),
  announcementCtrl.update
);
router.delete(
  "/admin/announcements/:id",
  auth,
  requirePermission("announcements.manage"),
  announcementCtrl.remove
);

module.exports = router;
