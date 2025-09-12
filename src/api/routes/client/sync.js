const router = require("express").Router();
const syncController = require('../../controllers/client/syncController');


router.post('/', syncController.getSync);


module.exports = router;