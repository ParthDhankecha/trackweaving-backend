const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const partChangeLogSchema = new Schema({
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine', 
        required: true
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    partName: {
        type: String,
        trim: true,
        required: true
    },
    changeDate: {
        type: Date,
        required: true
    },
    changedBy: {
        type: String,
        trim: true,
        required: true
    },
    changedByContact: {
        type: String,
        trim: true,
        default: ''
    },
    notes: {
        type: String,
        trim: true,
        default: ''
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

const partChangeLog = mongoose.model('partChangeLog', partChangeLogSchema, 'partChangeLog');
module.exports = partChangeLog;