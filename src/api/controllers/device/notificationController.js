const notificationService = require("../../services/notificationService");
const utilService = require("../../services/utilService");


module.exports = {
    getList: async (req, res, next) => {
        try {
            const pagination = utilService.getFilter(req.body);
            const data = { count: 0, list: [] };

            data.count = await notificationService.count({ userId: req.user.id });
            if (data.count > 0) {
                data.list = await notificationService.find({ userId: req.user.id }, {
                    ...pagination,
                    useLean: true,
                    projection: { title: 1, description: 1, isRead: 1, createdAt: 1 },
                    sort: { isRead: 1, createdAt: -1 }
                });
            }

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    getNotifications: async (req, res, next) => {
        try {
            let page = req.body.page ? parseInt(req.body.page) : 1;
            let limit = req.body.limit ? parseInt(req.body.limit) : 20;
            let skip = (page - 1) * limit;

            const notifications = await notificationService.find({ userId: req.user.id }, { skip, limit, useLean: true, sort: { createdAt: -1 } });

            return res.ok(notifications, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    readNotification: async (req, res, next) => {
        try {
            const { id: userId } = req.user;

            await notificationService.markAsRead({ userId: userId });

            return res.ok(null, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    unreadCount: async (req, res, next) => {
        try {
            const count = await notificationService.count({ userId: req.user.id, isRead: false });

            return res.ok({ count: count }, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    testNotification: async (req, res, next) => {
        try {
            const fields = ['payload', 'title', 'description', 'token'];
            await utilService.checkRequiredParams(fields, req.body);

            let data = await notificationService.sendTestNotification(
                req.body.payload,
                req.body.title,
                req.body.description,
                req.body.token
            );

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}