const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const manufacturerUserSchema = new Schema({
    manufacturerId: {
        type: Schema.Types.ObjectId,
        ref: 'manufacturer',
        required: true,
        index: true
    },
    contactPerson: {
        type: String,
        trim: true,
        default: ''
    },
    email: {
        type: String,
        trim: true,
        required: true,
        unique: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true,
        select: false
    },
    phone: {
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


const manufacturerUser = mongoose.model('manufacturerUser', manufacturerUserSchema, 'manufacturerUsers');
module.exports = manufacturerUser;