

const usersService = require("../../services/usersService");
const { log, checkRequiredParams } = require("../../services/utilService")



module.exports = {
    getById: async (req, res, next) => {
        try {
            checkRequiredParams(['id'], req.params);

            const user = await usersService.findById(req.params.id);
            if (!user) {
                return res.notFound(null, global.config.message.USER_NOT_FOUND);
            }

            return res.ok(user, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}