const fs = require('fs');
const { env } = require('../../config/env-vars');
const { errLog } = require('../services/utilService');

const SetupConfig = require('./config/setupConfig');
const ProjectConfig = require('./config/projectConfig');


function generatingModelObjectUsingModelFiles() {
    /**
     * You must add filename without extension as a string, and set into 'setToStatic' Array.
     * set 'model filename + Model' as a key for models object and also set value from ./filename.js
     */
    const setToStatic = ['projectConfig', 'setupConfig'];
    const models = {
        setupConfigModel: SetupConfig,
        projectConfigModel: ProjectConfig
    };

    /**
     * You must check the 'filename' as same as 'collection' name in singular.
     * '/^([a-z][A-Za-z]*)Model$/', This regex is for modelName and we can use it to globally.
     * checked only the file name and modelKeyName are same ro not.
     * require all model file from models folder, It returns array of string with file extension (like 'example.js').
     */
    const RegexModelName = /^([a-z][A-Za-z]*)Model$/;

    for (const modelName in models) {
        const exist = setToStatic.includes(modelName.replace('Model', ''));
        if (!RegexModelName.test(modelName) || !exist) {
            delete models[modelName];
            errLog(`Error: You need to check --> '${modelName}' <-- which is static set.('filename + Model' like as 'userModel')`);
        }
        if (typeof models[modelName] !== 'function' && exist) {
            delete models[modelName];
            errLog(`Error: ${modelName} from statically set, Has not set proper mongoose.model function, Check in ${__dirname}/${modelName.replace('Model', '.js')}`);
        }
    }

    /** Whenever you change the models/index* filename then you must change the below file filter 'string' which is compared. */
    const modelFiles = fs.readdirSync(__dirname).filter(file => file.includes('.js') && file !== 'indexModel.js' && !setToStatic.includes(file.replace('.js', '')));
    for (const file of modelFiles) {
        /**
         * replace '.js' file extension with Model, and Create model name using 'filename + Model'.
         * like user is a filename and concat with model string( userModel ).
         */
        const modelName = file.replace('.js', 'Model');
        if (RegexModelName.test(modelName)) {
            /**
             * Here we can require particular 'model file'(model is a collection).
             */
            const modelFromFile = require(`./${file}`);
            /** 
             * $caught is a meta key of mongoose model, Whenever any model file has more than one model exported it can't be set in model object.
             * mongoose has default 17 keys, keys list are below
             * ['hooks','base','modelName','model','db','discriminators','events','$appliedMethods','$appliedHooks','_middleware','$__insertMany','schema','collection','$__collection','Query','$init','$caught']
            */
            const checkObjectHasOneModel = Object.keys(modelFromFile);
            if (!checkObjectHasOneModel.includes('$caught') && checkObjectHasOneModel.length < 17)
                errLog(`Error: More then one model exported in ${__dirname}/${file} model file.`);
            else if (typeof modelFromFile !== 'function')
                errLog(`Error: ${modelName}, Has not set proper mongoose.model function, Check in ${__dirname}/${file}`);
            else models[modelName] = modelFromFile;

        } else {
            errLog(`Error: You have to renaming '${file}' filename, lower camel case (initial lowercase letter, also known as dromedary case) formate used.`);
        }
    };

    if (env === "development") {
        console.log("----------------------- List of Model Object -----------------------");
        console.log(`----------------------- Number of Models : ${setToStatic.length + modelFiles.length} -----------------------`);
        console.log(`----------------------- Available Models : ${Object.keys(models).length} -----------------------`);
        console.log(models);
        console.log("------------------------- End Of ModelList -------------------------");
    }

    return models;
}

module.exports = generatingModelObjectUsingModelFiles();