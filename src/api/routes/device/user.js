const router = require('express').Router();


const usersController = require('../../controllers/device/userController');
const isAuth = require('../../middleware/auth');


router.get('/:id', isAuth, usersController.getById);


module.exports = router;