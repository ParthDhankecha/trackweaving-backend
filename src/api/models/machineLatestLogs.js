const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const machineLatestLogsSchema = new Schema({
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine',
        required: true
    },
    rawData: {
        type: [Schema.Types.Mixed],
        default: []
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    speedRpm: {
        type: Number,
        default: 0
    },
    efficiencyPercent: {
        type: Number,
        default: 0
    },
    picksCurrentShift: {
        type: Number,
        default: 0
    },
    picksTotal: {
        type: Number,
        default: 0
    },
    pieceLengthM: {
        type: Number,
        default: 0
    },
    beamLeft: {
        type: Number,
        default: 0
    },
    setPicks: {
        type: Number,
        default: 0
    },
    stop: {
        type: Number,
        default: 0
    },
    alarmsActive: {
        type: [Schema.Types.Mixed],
        default: []
    },
    loomStateCode: {
        type: Number,
        default: 0
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

machineLatestLogsSchema.index({ machineId: 1, workspaceId: 1, createdAt: -1 });

const machineLatestLogs = mongoose.model('machineLatestLogs', machineLatestLogsSchema, 'machineLatestLogs');
module.exports = machineLatestLogs;