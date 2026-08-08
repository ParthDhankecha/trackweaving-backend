const router = require('express').Router();

const usersController = require('../../controllers/admin/userController');
const isAuth = require('../../middleware/auth');


router.post('/pagination', isAuth, usersController.getUsers);

router.post('/create', isAuth, usersController.createUser);

router.put('/update/:userId', isAuth, usersController.updateUser);

router.delete('/delete/:userId', isAuth, usersController.deleteUser);


module.exports = router;