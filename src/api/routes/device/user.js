const router = require('express').Router();


const usersController = require('../../controllers/device/userController');
const isAuth = require('../../middleware/auth');

router.get('/list', isAuth, usersController.list);

router.get('/:id', isAuth, usersController.getById);

router.get('/sync/data', usersController.syncData);

router.put('/fcm-token', isAuth, usersController.updateFcmToken);

router.delete('/fcm-token', isAuth, usersController.removeFcmToken);

router.post('/', isAuth, usersController.create);

router.put('/:id', isAuth, usersController.update);

module.exports = router;