const notificationService = require("../../services/notificationService");
const { log } = require("../../services/utilService");


module.exports = {
    getNotifications: async (req, res, next) => {
        try {
            let page = req.body.page ? parseInt(req.body.page) : 1;
            let limit = req.body.limit ? parseInt(req.body.limit) : 20;
            let skip = (page - 1) * limit;

            let notifications = await notificationService.find({ userId: req.user.id }, { skip, limit, useLean: true, sort: { createdAt: -1 } });

            return res.ok(notifications, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    readNotification: async (req, res, next) => {
        try {
            const notificationIds = req.body.notificationIds || [];
            if(!notificationIds.length) throw global.config.message.BAD_REQUEST;

            await notificationService.markAsRead({ _id: { $in: notificationIds }, userId: req.user.id });

            return res.ok({}, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    },

    unreadCount: async (req, res, next) => {
        try {
            const count = await notificationService.count({ userId: req.user.id, isRead: false });

            return res.ok({ count: count }, global.config.message.OK);
        } catch (error) {
            log(error);
            return res.serverError(error);
        }
    }
}