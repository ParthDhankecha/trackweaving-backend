const router = require('express').Router();

const controller = require('../../controllers/admin/leadController');
const auth = require('../../middleware/auth');


router.get('/stats', auth, controller.getStats);

router.get('/:id', auth, controller.getById);

router.post('/list', auth, controller.getList);

router.post('/check-duplicate', auth, controller.checkDuplicate);

router.post('/', auth, controller.create);

router.put('/:id', auth, controller.update);

router.delete('/:id', auth, controller.deleteById);


module.exports = router;
