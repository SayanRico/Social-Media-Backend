const router = require("express").Router();
const auth = require("../middleware/auth");
const deviceCtrl = require("../controllers/deviceCtrl");

router.post("/devices/register", auth, deviceCtrl.register);
router.post("/devices/unregister", auth, deviceCtrl.unregister);
router.get("/devices", auth, deviceCtrl.listMine);

module.exports = router;
