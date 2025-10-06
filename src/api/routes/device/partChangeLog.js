const router = require('express').Router();
const partChangeLogController = require('../../controllers/device/partChangeLogController');
const isAuth = require('../../middleware/auth');

router.post('/', isAuth, partChangeLogController.create);
router.put('/:id', isAuth, partChangeLogController.update);
router.get('/parts-list', isAuth, partChangeLogController.partsList);
router.post('/list', isAuth, partChangeLogController.list);

module.exports = router;