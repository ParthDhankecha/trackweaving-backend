var admin = require("firebase-admin");
var serviceAccount = require("../../../trackweaving-b0390-firebase-adminsdk-fbsvc-cb80dbd099.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

module.exports = {
    async createNotification(body, users = [], options = {}) {
        const { isTestMode = false } = options;

        if (!users.length) return;

        if (!isTestMode) {
            for (const user of users) {
                body.userId = user?._id || user;
                const notification = new notificationModel(body);
                await notification.save();
            }
        }

        let chunks = [];
        for (let i = 0; i < users.length; i += 5) {
            chunks.push(users.slice(i, i + 5));
        }

        const messages = chunks.map(chunk => ({
            notification: {
                title: body.title,
                body: body.description
            },
            condition: chunk.map(user => `'${user?._id || user}' in topics`).join(' || '),
            android: {
                notification: {
                    channelId: "general_notifications",
                    defaultSound: false,
                    priority: "high"
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "default",
                    },
                },
            },
            ...(body.payload ?? {}),
        }));

        const results = await Promise.all(messages.map(message => admin.messaging().send(message)));

        return results;
    },

    async createAlertNotification(body, userIds = [], options = {}) {
        const { isTestMode = false } = options;

        if (!userIds.length) return;

        if (!isTestMode) {
            for (let userId of userIds) {
                body.userId = userId;
                const notification = new notificationModel(body);
                await notification.save();
            }
        }

        let chunks = [];
        for (let i = 0; i < userIds.length; i += 5) {
            chunks.push(userIds.slice(i, i + 5));
        }

        var messages = chunks.map(chunk => ({
            notification: {
                title: body.title,
                body: body.description
            },
            condition: chunk.map(t => `'${t}' in topics`).join(' || '),
            data: {
                sound: "siren.caf",
                ...(body.payload ?? {}),
            },
            android: {
                notification: {
                    channelId: "alert_notifications",
                    defaultSound: false,
                    sound: "siren.mp3",
                    priority: "high"
                },
            },
            apns: {
                payload: {
                    aps: {
                        sound: "siren.caf",
                    },
                },
            },
        }));

        const results = await Promise.all(messages.map(message => admin.messaging().send(message)));

        return results;
    },

    async find(options = {}, queryOptions = {}) {
        queryOptions = {
            sort: undefined,
            skip: undefined,
            limit: undefined,
            projection: undefined,
            populate: undefined,
            useLean: false,
            ...queryOptions
        };

        const query = notificationModel.find({ ...options, isDeleted: false });

        if (queryOptions.sort) query.sort(queryOptions.sort);
        if (queryOptions.skip) query.skip(queryOptions.skip);
        if (queryOptions.limit) query.limit(queryOptions.limit);
        if (queryOptions.projection) query.select(queryOptions.projection);
        if (queryOptions.populate) query.populate(queryOptions.populate);
        if (queryOptions.useLean) query.lean();

        return await query;
    },

    async sendTestNotification(payload, title, description, token, playSiren = false) {
        let cb = playSiren ? this.createAlertNotification : this.createNotification;
        cb({ title, description, payload }, [token], { isTestMode: true });
    },

    async markAsRead(queryFilter) {
        return await notificationModel.updateMany(queryFilter, { isRead: true });
    },

    async count(condition = {}) {
        return await notificationModel.countDocuments({ ...condition, isDeleted: false });
    },

    async deleteOlderThan(date) {
        return await notificationModel.deleteMany({ createdAt: { $lt: date } });
    }
}