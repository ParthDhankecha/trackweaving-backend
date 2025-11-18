var admin = require("firebase-admin");
var serviceAccount = require("../../../trackweaving-b0390-firebase-adminsdk-fbsvc-cb80dbd099.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = {
    async createNotification(body, userIds = [], tokens = []) {
        if(!userIds.length) return;

        for(let userId of userIds) {
            body.userId = userId;
            const notification = new notificationModel(body);
            await notification.save();
        }
        
        if(tokens.length) {
            var message = {
                notification: {
                    title: body.title,
                    body: body.description
                },
                tokens: tokens
            };
            
            admin.messaging().sendEachForMulticast(message)
            .then((response) => {
                console.log(response.successCount + ' messages were sent successfully');
            });
        }
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

    async sendTestNotification(payload, title, description, token) {
        const message = {
            notification: {
                title: title,
                body: description
            },
            data: payload,
            token: token
        };

        return await admin.messaging().send(message);
    },

    async markAsRead(queryFilter) {
        return await notificationModel.updateMany(queryFilter, { isRead: true });
    },

    async count(condition = {}) {
        return await notificationModel.countDocuments({ ...condition, isDeleted: false });
    }
}