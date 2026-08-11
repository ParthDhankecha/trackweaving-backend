const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/appVersionController');


router.get('/', auth, controller.get);

router.post('/', auth, controller.create);

router.put('/', auth, controller.update);


module.exports = router;