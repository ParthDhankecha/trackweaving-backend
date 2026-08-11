const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/workspaceController');


router.post('/create', auth, controller.create);

router.post('/pagination', auth, controller.getList);

router.get('/option-list', auth, controller.getAllList);

router.get('/:id', auth, controller.getById);

router.put('/update/:id', auth, controller.updateById);


module.exports = router;