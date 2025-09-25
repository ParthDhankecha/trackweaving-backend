const router = require('express').Router();


const usersController = require('../../controllers/device/userController');
const isAuth = require('../../middleware/auth');


router.get('/:id', isAuth, usersController.getById);

router.get('/sync/data', usersController.syncData);


module.exports = router;