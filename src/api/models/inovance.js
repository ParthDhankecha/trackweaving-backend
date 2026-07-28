const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const inovanceSchema = new Schema({}, {
    strict: false,
    versionKey: false,
    timestamps: true
});

const inovance = mongoose.model('inovance', inovanceSchema, 'inovances');
module.exports = inovance;
