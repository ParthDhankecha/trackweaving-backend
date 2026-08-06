const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const platformVersionSchema = new Schema({
    min: {
        type: Number,
        required: true,
        default: 1
    },
    latest: {
        type: Number,
        required: true,
        default: 1
    },
    updateNote: {
        type: String,
        trim: true,
        default: ''
    }
}, { _id: false });

const appVersionSchema = new Schema({
    android: {
        type: platformVersionSchema,
        required: true,
        default: () => ({ min: 1, latest: 1, updateNote: '' })
    },
    ios: {
        type: platformVersionSchema,
        required: true,
        default: () => ({ min: 1, latest: 1, updateNote: '' })
    },
    // snapshot of previous android/ios values whenever config is updated
    history: {
        type: [Schema.Types.Mixed],
        default: []
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