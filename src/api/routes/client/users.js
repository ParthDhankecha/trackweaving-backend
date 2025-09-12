const router = require('express').Router();

const usersController = require('../../controllers/client/usersController');
const isAuth = require('../../middleware/auth');


// router.get('/', isAuth, usersController.getList);

// router.get('/:id', isAuth, usersController.getById);

// router.put('/:id', isAuth, usersController.update);

// router.delete('/:id', isAuth, usersController.delete);


module.exports = router;