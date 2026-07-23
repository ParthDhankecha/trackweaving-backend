const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const manufacturerSchema = new Schema({
    companyName: {
        type: String,
        trim: true,
        required: true
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