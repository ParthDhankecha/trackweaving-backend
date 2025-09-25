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

WorkspaceSchema.pre('save', async function (next) {
    if (this.isNew) {
        const lastDoc = await workspaceModel.findOne().sort({ _id: -1 });
        this.uId = lastDoc ? lastDoc.uid + 1 : 1;
        let categories = global.config.MAINTENANCE_CATEGORIES || [];
        for(let category of categories) {
            category.workspaceId = this._id;
        }
        await maintenanceCategoryModel.insertMany(categories);
        let machineGroup = new machineGroupModel({
            groupName: 'Jacquard',
            workspaceId: this._id,
        });
        await machineGroup.save();
    }
    next();
});


const model = mongoose.model('workspace', WorkspaceSchema, 'workspaces');
module.exports = model;