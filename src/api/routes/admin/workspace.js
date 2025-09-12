const router = require('express').Router();

const workspaceController = require('../../controllers/admin/workspaceController');
const isAuth = require('../../middleware/auth');

router.post('/create', isAuth, workspaceController.create);

router.post('/pagination', isAuth, workspaceController.getList);

router.get('/option-list', isAuth, workspaceController.getAllList);

router.get('/:id', isAuth, workspaceController.getById);

router.put('/update/:id', isAuth, workspaceController.updateById);


module.exports = router;