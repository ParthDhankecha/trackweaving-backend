const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = mongoose.Types;


const MachineGroupSchema = new Schema({
    groupName: {
        type: String,
        trim: true,
        required: true
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    createdBy: {
        type: Types.ObjectId,
        ref: 'user',
    },
    isDeleted: {
        type: Boolean,
        default: false,
        select: false
    }
},{
    versionKey: false,
    timestamps: true
});


const machineGroup = mongoose.model('machineGroup', MachineGroupSchema, 'machineGroups');
module.exports = machineGroup;