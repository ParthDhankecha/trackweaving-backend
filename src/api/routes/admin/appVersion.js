const router = require('express').Router();

const appVersionController = require('../../controllers/admin/appVersionController');

router.get('/:id', appVersionController.getById);

router.post('/list', appVersionController.list);

router.post('/', appVersionController.create);

router.put('/:id', appVersionController.update);

router.delete('/:id', appVersionController.delete);


module.exports = router;