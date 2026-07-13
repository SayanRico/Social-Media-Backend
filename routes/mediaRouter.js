const router = require("express").Router();
const auth = require("../middleware/auth");
const mediaCtrl = require("../controllers/mediaCtrl");

router.post("/media/validate", auth, mediaCtrl.validateUrls);

module.exports = router;
