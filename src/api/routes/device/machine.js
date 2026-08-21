const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/machineController');


router.get('/', auth, controller.getMachineList);

// Shared dropdown helper
router.get('/option-list', auth, controller.optionList);

router.put('/:id', auth, controller.updateMachine);


module.exports = router;