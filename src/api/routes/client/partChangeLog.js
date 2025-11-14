const router = require('express').Router();
const partChangeLogController = require('../../controllers/client/partChangeLogController');
const isAuth = require('../../middleware/auth');


router.get('/parts-list', isAuth, partChangeLogController.partsList);

router.post('/list', isAuth, partChangeLogController.list);

router.post('/', isAuth, partChangeLogController.create);

router.put('/:id', isAuth, partChangeLogController.update);


module.exports = router;