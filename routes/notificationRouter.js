const router = require("express").Router();
const auth = require("../middleware/auth");
const notificationEngineCtrl = require("../controllers/notificationEngineCtrl");

router.get("/notifications/catalog", auth, notificationEngineCtrl.getCatalog);
router.get("/notifications/unread-count", auth, notificationEngineCtrl.getUnreadCount);
router.post("/notifications/dispatch-test", auth, notificationEngineCtrl.dispatchTest);

module.exports = router;
