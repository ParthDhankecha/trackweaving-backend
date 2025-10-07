const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = mongoose.Types;

const NotificationSchema = new Schema({
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine'
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    isRead: {
        type: Boolean,
        default: false
    },
    description: {
        type: String,
        default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

// Best index for notification queries (example: unread notifications for a user)
NotificationSchema.index({ userId: 1, isRead: 1 });

NotificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model('notification', NotificationSchema, 'notifications');
module.exports = Notification;