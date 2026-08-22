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
    }
}, { _id: false });

const flavorConfigSchema = new Schema({
    android: {
        type: platformVersionSchema,
        required: true,
        default: () => ({ min: 1, latest: 1 })
    },
    ios: {
        type: platformVersionSchema,
        required: true,
        default: () => ({ min: 1, latest: 1 })
    }
}, { _id: false });

const historyEntrySchema = new Schema({
    build: {
        type: Number,
        required: true
    },
    version: {
        type: String,
        required: true
    },
    updateNote: {
        type: String,
        trim: true,
        default: null
    },
    changedAt: {
        type: Date,
        default: Date.now
    }
});

const appVersionSchema = new Schema({
    // flavor name -> { android, ios }. New flavors can be added without a schema change.
    flavors: {
        type: Map,
        of: flavorConfigSchema,
        default: () => new Map()
    },
    history: {
        type: [historyEntrySchema],
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