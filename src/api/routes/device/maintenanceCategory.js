const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/maintenanceCategoryController');


router.get('/', auth, controller.getList);

// Shared dropdown helper
router.get('/option-list', auth, controller.getOptionList);

router.post('/', auth, controller.create);

router.put('/:id', auth, controller.update);

router.delete('/:id', auth, controller.delete);


module.exports = router;