const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/machineController');


router.get('/configurations', auth, controller.getConfigurations);

router.get('/code/:workspaceId', auth, controller.getMachineCode);

router.get('/option-list/:workspaceId', auth, controller.optionList);

router.get('/:id', auth, controller.getById);

router.post('/create', auth, controller.create);

router.post('/', auth, controller.getList);

router.put('/update/:id', auth, controller.update);

router.delete('/delete/:id', auth, controller.delete);


module.exports = router;