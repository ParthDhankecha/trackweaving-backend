const fs = require('fs');
const path = require('path');

const { message } = require('../message');
const models = require('../../api/models/indexModel');
const { errLog, infoLog } = require('../../api/services/utilService');


exports.setGlobalConfigs = () => {
    global.config = {};

    /**
     * Set 'messages' to global for server response to user, Use as per requirement.
     */
    global.config.message = message;

    /**
     * set all 'constant' file's 'objects' and 'variables' only, not index file.
     */
    const constantFiles = fs.readdirSync(__dirname).filter(file => file.slice(-3) === '.js' && file != 'index.js');
    for (let i = 0; i < constantFiles.length; i++) {
        const fileData = require(`./${constantFiles[i]}`);
        global.config = { ...global.config, ...fileData };
    }

    /**
     * if src/public directory does not exist then create public directory and also create subdirectories if they mentioned.
     */
    const dirsToCreate = [
        path.join(__dirname, '..', '..', 'public'),
        path.join(__dirname, '..', '..', 'public', 'upload')
    ];
    for (const dirPath of dirsToCreate) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
            infoLog(`Directory successfully created. ${dirPath.replace(__dirname.replace('/config/constant', ''), '')}`);
        }
    }

    /**
     * Set all 'collection' dynamically with 'filename' as a collection name with 'Model', like user as an userModel.
     */
    if (!Array.isArray(models)) { /** is not Array, Actual Object{key:val} only. */
        for (const [modelName, modelFile] of Object.entries(models)) {
            global[modelName] = modelFile;
        }
    } else {
        errLog('Error while set models to Global Object. Check models/index* file.');
    }
}