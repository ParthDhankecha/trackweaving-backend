const router = require('express').Router();

const manufacturerUserController = require('../../controllers/admin/manufacturerUserController');
const isAuth = require('../../middleware/auth');


router.get('/:id', isAuth, manufacturerUserController.getById);

router.post('/create', isAuth, manufacturerUserController.create);

router.post('/pagination', isAuth, manufacturerUserController.getList);

router.put('/update/:id', isAuth, manufacturerUserController.updateById);

router.delete('/delete/:id', isAuth, manufacturerUserController.deleteById);


module.exports = router;