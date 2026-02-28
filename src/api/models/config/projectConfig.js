const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const projectConfigSchema = new Schema({
    projectName: { type: String, default: '' },
    serverUrl: { type: String, default: '' },
    clientUrl: { type: String, default: '' },
    refreshInterval: { type: Number, default: 10 }, // in seconds
    efficiencyGoodPer: { type: Number, default: 90 }, // in percentage
    efficiencyAveragePer: { type: Number, default: 85 }, // in percentage
    amcAmount: { type: Number, default: 0 },
    panNumber: { type: String, default: '' },
    gstNumber: { type: String, default: '' },
    sacCode: { type: String, default: '' },
    invoicePhone: { type: String, default: '' },
    invoiceAddress: { type: String, default: '' },
}, {
    timestamps: true,
    versionKey: false
});


const ProjectConfig = mongoose.model('ProjectConfig', projectConfigSchema, 'projectConfig');
module.exports = ProjectConfig;