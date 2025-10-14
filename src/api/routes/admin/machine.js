const router = require('express').Router();

const machineController = require('../../controllers/admin/machineController');
const isAuth = require('../../middleware/auth');


router.get('/code/:workspaceId', isAuth, machineController.getMachineCode);

router.get('/:id', isAuth, machineController.getById);

router.post('/create', isAuth, machineController.create);

router.post('/', isAuth, machineController.getList);

router.put('/update/:id', isAuth, machineController.update);

router.delete('/delete/:id', isAuth, machineController.delete);


module.exports = router;