const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const alertChannelSubSchemaObj = {
    notification: {
        type: Boolean,
        default: true
    },
    whatsapp: {
        type: Boolean,
        default: false
    }
};

const alertFlagsSubSchema = getSubSchema({
    pickChange: {
        type: getSubSchema(alertChannelSubSchemaObj),
        default: () => ({})
    },
    maxSpeed: {
        type: getSubSchema(alertChannelSubSchemaObj),
        default: () => ({})
    },
    lowSpeed: {
        type: getSubSchema(alertChannelSubSchemaObj),
        default: () => ({})
    },
    beamLeft: getSubSchema({
        ...alertChannelSubSchemaObj,
        thresholds: {
            type: String,
            default: '1000,900,800,700,600,500,400,300,200,100,50,25,0'
        }
    }),
    machineStopped: getSubSchema({
        ...alertChannelSubSchemaObj,
        minutes: {
            type: String,
            default: '10,20'
        }
    })
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