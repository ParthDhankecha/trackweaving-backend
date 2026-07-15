const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const Types = mongoose.Types;


const BeamLeftSchema = new Schema({
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
    shift: {
        type: String,
        required: true
    },
    quality: {
        type: String,
        default: null
    },
    startDate: {
        type: Date,
        required: true
    },
    startProduction: {
        type: Number,
        required: true
    },
    endDate: {
        type: Date,
        default: null
    },
    endProduction: {
        type: Number,
        default: null
    },
    productionMtr: {
        type: Number,
        default: null
    },
    beamLength: {
        type: Number,
        default: null
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


BeamLeftSchema.index({ machineId: 1, workspaceId: 1, createdAt: -1 });

const beamLeft = mongoose.model('beamLeft', BeamLeftSchema, 'beamLefts');
module.exports = beamLeft;