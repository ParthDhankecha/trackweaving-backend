const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const subShiftSchema = getSubSchema({
    startTime: {
        type: Date,
        default: null
    },
    endTime: {
        type: Date,
        default: null
    }
});

const WorkspaceSchema = new Schema({
    firmName: {
        type: String,
        trim: true,
        default: ''
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'user',
        required: true,
        index: true
    },
    GSTNo: {
        type: String,
        trim: true,
        default: ''
    },
    dayShift: {
        type: subShiftSchema
    },
    nightShift: {
        type: subShiftSchema
    },
    isActive: {
        type: Boolean,
        default: true
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


const model = mongoose.model('workspace', WorkspaceSchema, 'workspaces');
module.exports = model;