const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const machineStopsDataSubSchema = getSubSchema({
    start: {
        type: Date,
        trim: true,
        default: ''
    },
    end: {
        type: Date,
        trim: true,
        default: ''
    },
    statusCode: {
        type: Number
    },
    duration: {
        type: Number,
        default: 0
    }
});

const machineLogsSchema = new Schema({
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
        type: Number,
        enum: [0, 1, 2],
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
    lastStopTime: {
        type: Date
    },
    lastStartTime: {
        type: Date
    },
    stopsData: {
        type: getSubSchema({
            warp: {
                type: [machineStopsDataSubSchema],
                default: []
            },
            weft: {
                type: [machineStopsDataSubSchema],
                default: []
            },
            feeder: {
                type: [machineStopsDataSubSchema],
                default: []
            },
            manual: {
                type: [machineStopsDataSubSchema],
                default: []
            },
            other: {
                type: [{
                    start: {
                        type: Date,
                        trim: true,
                        default: ''
                    },
                    end: {
                        type: Date,
                        trim: true,
                        default: ''
                    },
                    duration: {
                        type: Number,
                        default: 0
                    },
                    statusCode: {
                        type: Number
                    }
                }],
                default: []
            }
        }),
        default: {}
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

machineLogsSchema.index({ machineId: 1, workspaceId: 1, createdAt: -1 });

const machineLogs = mongoose.model('machineLogs', machineLogsSchema, 'machineLogs');
module.exports = machineLogs;