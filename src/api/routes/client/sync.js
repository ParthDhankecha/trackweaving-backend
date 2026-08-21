const router = require("express").Router();

const controller = require('../../controllers/client/syncController');


router.post('/', controller.getSync);


module.exports = router;