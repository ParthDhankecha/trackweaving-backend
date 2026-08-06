const router = require('express').Router();

const controller = require('../../controllers/admin/appVersionController');


router.get('/', controller.get);

router.post('/', controller.create);

router.put('/', controller.update);


module.exports = router;