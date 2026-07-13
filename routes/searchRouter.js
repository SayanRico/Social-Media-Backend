const router = require("express").Router();
const auth = require("../middleware/auth");
const searchCtrl = require("../controllers/searchCtrl");

router.get("/search/global", auth, searchCtrl.globalSearch);

module.exports = router;
