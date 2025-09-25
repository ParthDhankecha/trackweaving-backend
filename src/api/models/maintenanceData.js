const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const maintenanceDataSchema = new Schema({
    maintenanceCategoryId: {
        type: Schema.Types.ObjectId,
        ref: 'maintenanceCategory',
        required: true
    },
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine',
        required: true
    },
    lastMaintenanceDate: {
        type: Date,
        required: true
    },
    nextMaintenanceDate: {
        type: Date,
        required: true
    },
    completedBy: {
        type: String,
        trim: true,
        default: ''
    },
    completedByMobile: {
        type: String,
        trim: true,
        default: ''
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    remarks: {
        type: String,
        trim: true,
        default: ''
    },
    history: {
        type: [Schema.Types.Mixed],
        default: []
    }
},{
    versionKey: false,
    timestamps: true
});

const maintenanceData = mongoose.model('maintenanceData', maintenanceDataSchema, 'maintenanceData');
module.exports = maintenanceData;