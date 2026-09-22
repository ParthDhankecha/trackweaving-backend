const router = require("express").Router();

const auth = require("../../middleware/auth");
const controller = require("../../controllers/client/dashboardController");


router.post('/list', auth, controller.getList);

router.post('/custom', auth, controller.customView);

router.post('/custom-2', auth, controller.customView2);


module.exports = router;