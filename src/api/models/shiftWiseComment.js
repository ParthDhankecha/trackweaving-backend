const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const shiftWiseCommentSchema = new Schema({
    machineId: {
        type: Schema.Types.ObjectId,
        ref: 'machine',
        required: true
    },
    shift: {
        type: String,
        enum: ['day', 'night'],
        required: true
    },
    comment: {
        type: String,
        trim: true,
        default: ''
    },
    date: {
        type: Date,
        required: true
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    versionKey: false,
    timestamps: true
});

const shiftWiseComment = mongoose.model('shiftWiseComment', shiftWiseCommentSchema, 'shiftWiseComment');
module.exports = shiftWiseComment;