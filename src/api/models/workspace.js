const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const subShiftSchema = getSubSchema({
    startTime: {
        type: String,
        default: null
    },
    endTime: {
        type: String,
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
    uid: {
        type: Number,
        default: null
    },
    manufacturerId: {
        type: Schema.Types.ObjectId,
        ref: 'manufacturer',
        default: null,
        index: true
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

const { DEFAULT_ALERT_FLAGS } = require('../../config/constant/alert');
const { MAINTENANCE_CATEGORIES } = require('../../config/constant/scoped/maintenanceCategory');
WorkspaceSchema.pre('save', async function (next) {
    if (this.isNew) {
        const lastDoc = await workspaceModel.findOne().sort({ _id: -1 });
        this.uid = lastDoc ? lastDoc.uid + 1 : 1;

        const categories = MAINTENANCE_CATEGORIES.map(obj => ({
            ...obj,
            workspaceId: this._id
        }));

        await maintenanceCategoryModel.insertMany(categories);

        await alertConfigModel.create({
            workspaceId: this._id,
            userId: null,
            alerts: JSON.parse(JSON.stringify(DEFAULT_ALERT_FLAGS || {}))
        });
    }
    next();
});


const model = mongoose.model('workspace', WorkspaceSchema, 'workspaces');
module.exports = model;