const router = require('express').Router();

const usersController = require('../../controllers/admin/userController');
const isAuth = require('../../middleware/auth');

router.post('/pagination', isAuth, usersController.getUsers);

// router.post('/create', isAuth, usersController.createUser);

router.get('/:userId', isAuth, usersController.getUserById);

router.put('/update/:userId', isAuth, usersController.updateUserById);

router.delete('/delete/:userId', isAuth, usersController.deleteUserById);


module.exports = router;

