const router = require('express').Router();

const controller = require('../../controllers/device/machineController');
const auth = require('../../middleware/auth');


router.get('/', auth, controller.getMachineList);

router.get('/option-list', auth, controller.optionList);

router.put('/:id', auth, controller.updateMachine);


module.exports = router;