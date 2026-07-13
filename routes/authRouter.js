const router = require("express").Router();
const authCtrl = require("../controllers/authCtrl");
const auth = require("../middleware/auth");
const authAdmin = require("../middleware/authAdmin");

router.post("/register", authCtrl.register);
router.post("/register_admin", auth, authAdmin, authCtrl.registerAdmin);
router.post("/changePassword", auth, authCtrl.changePassword);

router.post("/login", authCtrl.login);
router.post("/admin_login", authCtrl.adminLogin);

router.post("/logout", authCtrl.logout);
router.post("/logout_all", auth, authCtrl.logoutAll);

router.post("/refresh_token", authCtrl.generateAccessToken);

router.patch("/notification-preferences", auth, authCtrl.updateNotificationPreferences);
router.post("/admin/2fa/setup", auth, authAdmin, authCtrl.setup2FA);
router.post("/admin/2fa/verify", auth, authAdmin, authCtrl.verify2FA);

module.exports = router;