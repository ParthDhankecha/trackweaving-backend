const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const projectConfigSchema = new Schema({
    projectName: { type: String, default: '' },
    serverUrl: { type: String, default: '' },
    clientUrl: { type: String, default: '' },
    refreshInterval: { type: Number, default: 10 }, // in seconds
    efficiencyGoodPer: { type: Number, default: 90 }, // in percentage
    efficiencyAveragePer: { type: Number, default: 85 }, // in percentage
}, {
    timestamps: true,
    versionKey: false
});


const ProjectConfig = mongoose.model('ProjectConfig', projectConfigSchema, 'projectConfig');
module.exports = ProjectConfig;