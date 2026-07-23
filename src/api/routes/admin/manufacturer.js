const router = require('express').Router();

const manufacturerController = require('../../controllers/admin/manufacturerController');
const isAuth = require('../../middleware/auth');


router.get('/option-list', isAuth, manufacturerController.getAllList);

router.get('/:id', isAuth, manufacturerController.getById);

router.post('/create', isAuth, manufacturerController.create);

router.post('/pagination', isAuth, manufacturerController.getList);

router.put('/update/:id', isAuth, manufacturerController.updateById);

router.put('/assign-workspaces/:id', isAuth, manufacturerController.assignWorkspaces);

router.delete('/delete/:id', isAuth, manufacturerController.deleteById);


module.exports = router;