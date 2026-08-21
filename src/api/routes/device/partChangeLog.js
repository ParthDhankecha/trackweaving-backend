const router = require('express').Router();

const auth = require('../../middleware/auth');
const controller = require('../../controllers/device/partChangeLogController');


router.get('/parts-list', auth, controller.partsList);

router.post('/list', auth, controller.list);

router.post('/', auth, controller.create);

router.put('/:id', auth, controller.update);

router.delete('/:id', auth, controller.delete);


module.exports = router;