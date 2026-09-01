const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { SHIFT_TYPE } = require('../../config/constant/machineLog');


const operatorSchema = new Schema({
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    operatorName: {
        type: String,
        trim: true,
        required: true
    },
    shift: {
        type: Number,
        enum: Object.values(SHIFT_TYPE),
        required: true
    },
    machineIds: {
        type: [Schema.Types.ObjectId],
        ref: 'machine',
        default: []
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

operatorSchema.index({ workspaceId: 1, operatorName: 1, isDeleted: 1 }, {
    partialFilterExpression: { isDeleted: false }
});
operatorSchema.index({ workspaceId: 1, shift: 1, isDeleted: 1 }, {
    partialFilterExpression: { isDeleted: false }
});


const operator = mongoose.model('operator', operatorSchema, 'operators');
module.exports = operator;