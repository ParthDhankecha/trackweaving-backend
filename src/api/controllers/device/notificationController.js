const notificationService = require("../../services/notificationService");
const utilService = require("../../services/utilService");


module.exports = {
    getList: async (req, res, next) => {
        try {
            const body = req.body;
            const data = {
                unreadCount: 0,
                count: 0,
                list: [],
            };

            const query = { userId: req.user.id };
            if (Array.isArray(body.categories) && body.categories.length > 0) {
                query.category = { $in: body.categories };
            }

            const userId = req.user.id;
            data.unreadCount = await notificationService.count({ userId: userId, isRead: false });
            data.count = await notificationService.count(query);

            if (data.count > 0) {
                const pagination = utilService.getFilter(body);
                data.list = await notificationService.find(query, {
                    ...pagination,
                    useLean: true,
                    projection: { title: 1, description: 1, category: 1, data: 1, isRead: 1, createdAt: 1 },
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

            const notifications = await notificationService.find({ userId: req.user.id }, {
                skip, limit,
                useLean: true,
                sort: { createdAt: -1 }
            });

            return res.ok(notifications, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    },

    readNotification: async (req, res, next) => {
        try {
            const { id: userId } = req.user;

            await notificationService.markAsRead({ userId: userId, isRead: false });

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
                req.body.token,
                req.body.playSiren
            );

            return res.ok(data, global.config.message.OK);
        } catch (error) {
            utilService.log(error);
            return res.serverError(error);
        }
    }
}