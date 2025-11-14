const router = require('express').Router();
const machineController = require('../../controllers/client/machineController');
const isAuth = require('../../middleware/auth');


router.get('/option-list', isAuth, machineController.optionList);

router.get('/', isAuth, machineController.getMachineList);

router.put('/:id', isAuth, machineController.updateMachine);


module.exports = router;