const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const projectConfigSchema = new Schema({
    projectName: { type: String, default: '' },
    serverUrl: { type: String, default: '' },
    clientUrl: { type: String, default: '' }
}, {
    timestamps: true,
    versionKey: false
});


const ProjectConfig = mongoose.model('ProjectConfig', projectConfigSchema, 'projectConfig');
module.exports = ProjectConfig;