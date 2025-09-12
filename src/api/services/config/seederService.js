const fs = require('fs');
const { join } = require('path');
const _ = require('lodash');

const { errLog, infoLog, warnLog } = require('../utilService');


module.exports = {
    async seedingSeeds() {
        try {
            /** set SEEDER_DATA items object which we want to seed them in the database */
            const seeder_data = global.config.SEEDER_DATA_CONFIG;
            if (!seeder_data || !seeder_data.length) {
                warnLog('Seeder service has no data to seeding...!');
                return;
            }

            /** its important that we loop through SEEDER_DATA_CONFIG (Array of Object which set in constant.js file) **/
            await Promise.all(_.map(seeder_data, async (seederItem) => {

                /** get fileName, unique filed name And model name **/
                const { fileName, uniqueField, model: Model } = seederItem;

                /** read the data before you seed them **/
                let data = JSON.parse(fs.readFileSync(join(global.appPath, 'src', 'seeder-data', `${fileName}.json`), 'utf8'));

                /** gives the total unique field array */
                /** getting the unique field value using uniqueField key for comparing data with model(collection). **/
                const uniqueFieldValue = _.map(data, uniqueField);

                /** finding out the current total records **/
                let records = await global[Model].find({
                    [uniqueField]: { $in: uniqueFieldValue }
                });

                /** removing already existing records in model(collection). **/
                if (records && _.size(records) > 0) {
                    for (let record of records) {
                        let index = _.findIndex(data, {
                            [uniqueField]: record[uniqueField]
                        });
                        if (index > -1) {
                            data.splice(index, 1);
                        }
                    }
                }

                /** adding records one after one **/
                await Promise.all(_.map(data, async (record) => {
                    try {
                        /** Create new seeder record 
                         * we are Skip or Disable validation using 'validateBeforeSave' for mongoose model create() for save record in collection.
                         **/
                        if (Model == "userModel") {
                            await global[Model].create([record], { validateBeforeSave: false });
                        } else {
                            await global[Model].create(record);
                        }
                    } catch (e) {
                        errLog(`Error while seed(saving) record: ${e}`);
                    }
                }));
                
                if (_.size(data)) {
                    infoLog(`\n--------------------------------------------------------------------------------\n| Congratulations, We have seeded "${fileName} model" successfully. |\n--------------------------------------------------------------------------------`);
                } else {
                    infoLog(`\n--------------------------------------------------------------------------------\n| Don't worry, We have already seeded "${fileName} model" successfully. |\n--------------------------------------------------------------------------------`);
                }
            }));
        } catch (e) {
            errLog(`Error while seeding: ${e}`);
        }
    },

    async seedAllConfig() {
        return await this.seedingSeeds();
    }
};