
const _ = require('lodash');
const crypto = require('crypto');
const omittedFields = ['-_id', '-createdAt', '-updatedAt'];


module.exports = {
    camelCaseToCapitalUnderscore(inputStr) {
        const str = inputStr.replace(/(?:^|\.?)([A-Z])/g, (x, y) => `_${y}`).replace(/^_/, '');
        return str.toUpperCase();
    },

    setValueToGlobal(configObj, decryptionNeeded = false) {
        // configObj.nested = {
        //     key1: configObj.projectName,
        //     key2: configObj.projectName,
        //     nestedKey: {
        //         nestedKey1: ['configObj', 'projectName'],
        //         nestedKey2: configObj.projectName
        //     }
        // };

        const setNestedValues = (obj, parentObj) => {
            for (const key in obj) {
                const nestedKey = this.camelCaseToCapitalUnderscore(key);
                if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
                    if (!parentObj[nestedKey]) {
                        parentObj[nestedKey] = {};
                    }
                    setNestedValues(obj[key], parentObj[nestedKey]);
                } else {
                    let configValue = decryptionNeeded && _.isString(obj[key]) ? this.decrypt(obj[key]) : obj[key];
                    parentObj[nestedKey] = configValue;
                }
            }
        };

        setNestedValues(configObj, global.config);

        // let configValue;
        // for (const prop in configObj) {
        //     if (decryptionNeeded && !_.isString(configObj[prop])) {
        //         continue;
        //     }
        //     if (decryptionNeeded) {
        //         configValue = this.decrypt(configObj[prop]);
        //     } else {
        //         configValue = configObj[prop];
        //     }
        //     global.config[this.camelCaseToCapitalUnderscore(prop)] = configValue;
        // }
    },

    encrypt(plainText) {
        if (plainText === '') {
            return plainText;
        }
        const workingKey = "F5F7H41DSSF1E6FBHNGI1FUD1DV8UDSDSJ2JJDS2FBDJ";
        let m = crypto.createHash('md5');
        m.update(workingKey);
        if (m) {
            let key = m.digest();
            let iv = '\x0c\x0d\x0e\x0f\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b';
            let cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
            let encoded = cipher.update(plainText, 'utf8', 'hex');
            encoded += cipher.final('hex');

            return encoded;
        }
    },

    decrypt(encText) {
        if (encText === '') {
            return encText;
        }
        const workingKey = "F5F7H41DSSF1E6FBHNGI1FUD1DV8UDSDSJ2JJDS2FBDJ";
        let m = crypto.createHash('md5');
        m.update(workingKey);
        let key = m.digest();
        let iv = '\x0c\x0d\x0e\x0f\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0a\x0b';
        let decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        let decoded = decipher.update(encText, 'hex', 'utf8');
        decoded += decipher.final('utf8');

        return decoded;
    },

    getDecryptedObj(configObj) {
        // let decryptedValue;
        // let configValue;

        // for (let prop in configObj) {
        //     configValue = configObj[prop];
        //     if (!_.isString(configValue) || configValue === '') {
        //         continue;
        //     }
        //     decryptedValue = this.decrypt(configValue);
        //     configObj[prop] = decryptedValue;
        // }

        // return configObj;
        // configObj.nested = {
        //     key1: configObj.projectName,
        //     key2: configObj.projectName,
        //     nestedKey: {
        //         nestedKey1: ['configObj', 'projectName'],
        //         nestedKey2: configObj.projectName
        //     }
        // };
        const decryptNestedValues = (obj) => {
            for (const key in obj) {
                const configValue = obj[key];
                if (typeof configValue === 'object' && !Array.isArray(configValue)) {
                    decryptNestedValues(configValue); // Recurse into nested object
                } else if (_.isString(configValue) && configValue !== '') {
                    obj[key] = this.decrypt(configValue);
                }
            }
        };

        decryptNestedValues(configObj);
        return configObj;
    },

    async getConfigObj(model) {
        const config = await global[model].findOne({}).select(omittedFields).lean();
        return config;
    },

    async buildProjectConfig() {
        const projectConfig = await this.getConfigObj('projectConfigModel');
        if (projectConfig) {
            this.setValueToGlobal(projectConfig);
        } else {
            return "Error: Need to set record in projectConfig collection because collection is empty.";
        }
    },

    async buildSetupConfig() {
        const setupConfig = await this.getConfigObj('setupConfigModel');
        if (setupConfig) {
            this.setValueToGlobal(setupConfig, true);
        } else {
            return "Error: Need to set record in setupConfig collection because collection is empty.";
        }
    },

    // from admin controller
    async getSetupConfig() {
        let setupConfig = await this.getConfigObj('setupConfigModel');
        setupConfig = this.getDecryptedObj(setupConfig);

        return setupConfig;
    },

    // from admin controller
    async getProjectConfig() {
        const projectConfig = await this.getConfigObj('projectConfigModel');
        return projectConfig;
    },

    // from admin controller
    async updateConfig(body, model, securityEnabled = false) {
        let fieldsToUpdate = _.omit(body, ['_id']);
        if (securityEnabled) {
            const flattenObject = (obj, parentKey = '') => {
                let result = {};
                for (const key in obj) {
                    const newKey = parentKey ? `${parentKey}.${key}` : key;
                    const value = obj[key];

                    if (typeof value === 'object' && !Array.isArray(value)) {
                        Object.assign(result, flattenObject(value, newKey)); // Recurse into nested object
                    } else {
                        result[newKey] = value;
                    }
                }
                return result;
            };
            // Flatten the object to handle nested fields
            fieldsToUpdate = flattenObject(fieldsToUpdate);
            for (let prop in fieldsToUpdate) {
                if (!_.isString(fieldsToUpdate[prop]) || !fieldsToUpdate[prop]) {
                    continue;
                }
                fieldsToUpdate[prop] = this.encrypt(fieldsToUpdate[prop]);
            }
        }

        const updatedRecord = await global[model].findOneAndUpdate({}, fieldsToUpdate, { new: true }).select(omittedFields).lean();
        if (!updatedRecord) {
            throw new Error("Configuration record not found.");
        }

        this.setValueToGlobal(updatedRecord, securityEnabled);
        if (securityEnabled) {
            return this.getDecryptedObj(updatedRecord);
        }

        return updatedRecord;
    }
}