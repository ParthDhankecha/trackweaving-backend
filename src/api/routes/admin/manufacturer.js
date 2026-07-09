const router = require('express').Router();

const manufacturerController = require('../../controllers/admin/manufacturerController');
const isAuth = require('../../middleware/auth');

router.post('/create', isAuth, manufacturerController.create);

router.post('/pagination', isAuth, manufacturerController.getList);

router.get('/option-list', isAuth, manufacturerController.getAllList);

router.get('/:id', isAuth, manufacturerController.getById);

router.put('/update/:id', isAuth, manufacturerController.updateById);

router.delete('/delete/:id', isAuth, manufacturerController.deleteById);

router.put('/assign-workspaces/:id', isAuth, manufacturerController.assignWorkspaces);


module.exports = router;
