const router = require('express').Router();

const usersController = require('../../controllers/device/userController');
const auth = require('../../middleware/auth');


router.get('/list', auth, usersController.list);

router.get('/profile', auth, usersController.getProfile);

router.get('/:id', auth, usersController.getById);

router.get('/sync/data', usersController.syncData);

router.post('/', auth, usersController.create);

router.put('/:id', auth, usersController.update);


module.exports = router;