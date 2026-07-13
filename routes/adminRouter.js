const router = require("express").Router();
const auth = require("../middleware/auth");
const authAdmin = require("../middleware/authAdmin");
const adminCtrl = require("../controllers/adminCtrl");

router.get("/get_total_users", auth, authAdmin, adminCtrl.getTotalUsers);
router.get("/get_total_posts", auth, authAdmin, adminCtrl.getTotalPosts);
router.get("/get_total_comments", auth, authAdmin, adminCtrl.getTotalComments);
router.get("/get_total_likes", auth, authAdmin, adminCtrl.getTotalLikes);
router.get(
  "/get_total_spam_posts",
  auth,
  authAdmin,
  adminCtrl.getTotalSpamPosts
);
router.get("/get_spam_posts", auth, authAdmin, adminCtrl.getSpamPosts);
router.delete(
  "/delete_spam_posts/:id",
  auth,
  authAdmin,
  adminCtrl.deleteSpamPost
);
router.patch("/ban_user/:id", auth, authAdmin, adminCtrl.banUser);
router.patch("/unban_user/:id", auth, authAdmin, adminCtrl.unbanUser);
router.get("/admin/system-health", auth, authAdmin, adminCtrl.getSystemHealth);

module.exports = router;
