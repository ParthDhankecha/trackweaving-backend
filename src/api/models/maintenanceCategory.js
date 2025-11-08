const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const maintenanceCategorySchema = new Schema({
    name: {
        type: String,
        trim: true,
        required: true
    },
    categoryType: {
        type: String,
        required: true
    },
    scheduleDays: {
        type: Number,
        default: 0
    },
    alertDays: {
        type: Number,
        default: 0
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        required: true
    },
    alertMessage: {
        type: String,
        trim: true,
        default: ''
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


const maintenanceCategory = mongoose.model('maintenanceCategory', maintenanceCategorySchema, 'maintenanceCategory');
module.exports = maintenanceCategory;