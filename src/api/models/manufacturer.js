const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const manufacturerSchema = new Schema({
    companyName: {
        type: String,
        trim: true,
        required: true
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
    contactPerson: {
        type: String,
        trim: true,
        default: ''
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


const manufacturer = mongoose.model('manufacturer', manufacturerSchema, 'manufacturers');
module.exports = manufacturer;
