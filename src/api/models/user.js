const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { USERS } = require('../../config/constant/user');
const { SHIFT_TYPE } = require('../../config/constant/machineLog');


const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const UserSchema = new Schema({
    fullname: {
        type: String,
        default: '',
        trim: true
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'workspace',
        default: null
    },
    userName: {
        type: String,
        required: true,
        trim: true,
        default: '',
    },
    mobile: {
        type: String,
        default: '',
        trim: true
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        default: '',
    },
    password: {
        type: String,
        trim: true,
        default: '',
        select: false
    },
    userType: {
        type: Number,
        enum: [USERS.TYPE.ADMIN, USERS.TYPE.MASTER],
        default: USERS.TYPE.MASTER
    },
    shift: {
        type: [{ type: Number, enum: Object.values(SHIFT_TYPE) }]
    },
    machineIds: {
        type: [Schema.Types.ObjectId],
        ref: 'machine',
    },
    plan: getSubSchema({
        startDate: {
            type: Date,
            default: null
        },
        endDate: {
            type: Date,
            default: null
        },
        subUserLimit: {
            type: Number,
            default: 4
        }
    }),
    isActive: {
        type: Boolean,
        default: true
    },
    receiveWhatsappReport: {
        type: Boolean,
        default: false
    },
    // Module-wise CRUD/export access for MASTER users. ADMIN ignores this (full access).
    access: {
        type: Schema.Types.Map,
        of: {
            type: [String],
        },
        select: false
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


const model = mongoose.model('user', UserSchema, 'users');
module.exports = model;