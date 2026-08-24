const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/userController');


router.get('/list', auth, controller.getList);

router.get('/profile', auth, controller.getProfile);

router.get('/sync/data', controller.syncData);

router.post('/', auth, controller.create);

router.put('/:id', auth, controller.update);

router.delete('/:id', auth, controller.delete);


module.exports = router;