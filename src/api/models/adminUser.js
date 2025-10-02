const mongoose = require('mongoose');
const { USERS } = require('../../config/constant/user');
const Schema = mongoose.Schema;
const Types = mongoose.Types;


const getSubSchema = (subSchema, schemaOptions = {}) => {
    return new Schema(subSchema, { _id: false, ...schemaOptions });
};

const adminUserSchema = new Schema({
    email: {
        type: String,
        trim: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    userType: {
        type: Number,
        enum: [USERS.TYPE.SUPER_ADMIN],
        default: USERS.TYPE.SUPER_ADMIN
    }
},{
    versionKey: false,
    timestamps: true
});

const adminUser = mongoose.model('adminUser', adminUserSchema, 'adminUsers');
module.exports = adminUser;