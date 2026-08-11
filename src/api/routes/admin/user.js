const router = require('express').Router();

const auth = require('../../middleware/adminAuth');
const controller = require('../../controllers/admin/userController');


router.post('/pagination', auth, controller.getUsers);

router.post('/create', auth, controller.createUser);

router.put('/update/:userId', auth, controller.updateUser);

router.delete('/delete/:userId', auth, controller.deleteUser);


module.exports = router;