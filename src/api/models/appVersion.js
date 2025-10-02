const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const appVersionSchema = new Schema({
    appType: {
        type: String,
        enum: ['android', 'ios'],
        trim: true,
        required: true
    },
    version: {
        type: String,
        trim: true,
        required: true
    },
    showPopup: {
        type: Boolean,
        default: false
    },
    hardUpdate: {
        type: Boolean,
        default: false
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true,
    versionKey: false
});

const AppVersion = mongoose.model('appVersion', appVersionSchema, 'appVersions');
module.exports = AppVersion;