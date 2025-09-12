const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const setupConfigSchema = new Schema({
    projectName: { type: String, default: '' },
    mailAuthUser: { type: String, default: '' },
    mailAuthPass: { type: String, default: '' },
}, {
    versionKey: false,
    timestamps: true
});


const SetupConfig = mongoose.model('SetupConfig', setupConfigSchema, 'setupConfig');
module.exports = SetupConfig;