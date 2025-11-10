const router = require('express').Router();

const usersController = require('../../controllers/client/usersController');
const isAuth = require('../../middleware/auth');


router.get('/', isAuth, usersController.getList);

// router.get('/:id', isAuth, usersController.getById);

router.post('/', isAuth, usersController.create);

router.put('/:id', isAuth, usersController.update);


module.exports = router;