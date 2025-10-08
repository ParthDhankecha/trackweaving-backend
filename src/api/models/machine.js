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
    machineGroupId: {
        type: Schema.Types.ObjectId,
        ref: 'machineGroup',
        default: null
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
    isAlertActive: {
        type: Boolean,
        default: true
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
    deviceType: {
        type: String,
        default: 'lan',
        enum: ['lan', 'rs485']
    },
    maxSpeedLimit: {
        type: Number,
    },
    displayType: {
        type: String,
        default: 'nazon'
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    versionKey: false,
    timestamps: true
});

machineSchema.pre('save', async function (next) {
    if (this.isNew) {
        let maintenanceCategories = await maintenanceCategoryModel.find({ workspaceId: this.workspaceId });
        for(let category of maintenanceCategories) {
            let categoryDataRecord = new maintenanceDataModel({
                maintenanceCategoryId: category._id,
                workspaceId: this.workspaceId,
                machineId: this._id,
                lastMaintenanceDate: new Date(),
                nextMaintenanceDate: new Date(new Date().setDate(new Date().getDate() + category.scheduleDays)),
                remarks: ''
            });
            await categoryDataRecord.save();
        }
    }
    next();
});

const machine = mongoose.model('machine', machineSchema, 'machines');
module.exports = machine;