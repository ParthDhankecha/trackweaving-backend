const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/manufacturerUserController');


router.get('/:id', auth, controller.getById);

router.post('/create', auth, controller.create);

router.post('/pagination', auth, controller.getList);

router.put('/update/:id', auth, controller.updateById);

router.delete('/delete/:id', auth, controller.deleteById);


module.exports = router;