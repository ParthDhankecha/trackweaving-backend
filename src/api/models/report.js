const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reportSchema = new Schema({
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine',
        required: true
    },
    rawData: {
        type: Schema.Types.Mixed,
        default: []
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    shift: {
        type: String,
        enum: ['A', 'B', 'C'],
        required: true
    },
    reportDate: {
        type: Date,
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
    runTime: {
        type: String,
        default: "00:00:00"
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

reportSchema.index({ machineId: 1, shift: 1, workspaceId: 1, reportDate: 1 }, { unique: true });

const report = mongoose.model('report', reportSchema, 'report');
module.exports = report;