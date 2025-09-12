const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = mongoose.Types;

const MachineGroupSchema = new Schema({
    groupName: {
        type: String,
        trim: true,
        required: true
    },
    serialNumber: {
        type: String,
        trim: true,
        default: ''
    },
    createdBy: {
        type: Types.ObjectId,
        ref: 'user',
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
},{
    versionKey: false,
    timestamps: true
});

const machineGroup = mongoose.model('machineGroup', MachineGroupSchema, 'machineGroups');
module.exports = machineGroup;