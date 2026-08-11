const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/invoiceController');


router.get('/options', auth, controller.getOptions);

router.get('/configuration', auth, controller.getConfiguration);

router.get('/:id', auth, controller.getById);

router.post('/list', auth, controller.getList);

router.post('/', auth, controller.create);

router.put('/:id/payment-status', auth, controller.updatePaymentStatus);

router.put('/:id', auth, controller.update);

router.delete('/:id', auth, controller.deleteById);


module.exports = router;