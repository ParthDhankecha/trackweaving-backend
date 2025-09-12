const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = mongoose.Types;

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
    duration: {
        type: Number,
        default: 0
    }
});

const machineSchema = new Schema({
    serialNumber: {
        type: String,
        trim: true,
        default: ''
    },
    machineCode: {
        type: String,
        trim: true,
        required: true
    },
    machineName: {
        type: String,
        trim: true,
        required: true
    },
    ip: {
        type: String,
        trim: true,
        default: ''
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    lastStopTime: {
        type: String,
        default: null
    },
    lastStartTime: {
        type: String,
        default: null
    },
    stopsCount: {
        type: Number,
        default: 0
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
}, {
    versionKey: false,
    timestamps: true
});

const machine = mongoose.model('machine', machineSchema, 'machines');
module.exports = machine;