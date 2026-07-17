const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const alertFlagsSubSchema = getSubSchema({
    pickChange: {
        type: Boolean,
        default: true
    },
    maxSpeed: {
        type: Boolean,
        default: true
    },
    lowSpeed: {
        type: Boolean,
        default: true
    },
    beamLeft: {
        type: Boolean,
        default: true
    }
});

/**
 * Alert configuration — admin-managed.
 * - userId = null  → workspace-level defaults
 * - userId = ObjectId → per-user override (takes precedence over workspace)
 */
const alertConfigSchema = new Schema({
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true,
        index: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        default: null,
        index: true
    },
    alerts: {
        type: alertFlagsSubSchema,
        default: () => ({})
    },
    isDeleted: {
        type: Boolean,
        default: false,
        select: false
    }
}, {
    versionKey: false,
    timestamps: true
});

alertConfigSchema.index(
    { workspaceId: 1, userId: 1 },
    { unique: true, partialFilterExpression: { isDeleted: false } }
);


const alertConfig = mongoose.model('alertConfig', alertConfigSchema, 'alertConfigs');
module.exports = alertConfig;