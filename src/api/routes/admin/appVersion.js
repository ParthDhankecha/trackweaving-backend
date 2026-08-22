const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/appVersionController');


router.get('/', auth, controller.get);

router.put('/', auth, controller.update);

router.post('/history', auth, controller.addHistory);

router.put('/history/:id', auth, controller.updateHistory);

router.delete('/history/:id', auth, controller.deleteHistory);


module.exports = router;